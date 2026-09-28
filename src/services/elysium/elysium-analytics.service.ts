import { prismaHistorical } from '../../core/prisma.historical.service';
import { cacheService } from '../../core/cache.service';
import { ElysiumIngestRepository } from '../../repositories/prisma/prisma.elysium.repository';
import {
  fillDays,
  lastDays,
  precompileLabel,
  PRECOMPILE_LIKE,
  retentionFraction,
  share,
  toDayKey,
} from './elysium-analytics.util';

const CACHE_TTL_S = 60;
const CACHE_PREFIX = 'elysium:analytics';
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
/** Epoch millis (from SQL) -> ISO string. */
const iso = (v: number | null): string | null => (v === null || v === undefined ? null : new Date(Number(v)).toISOString());
/** Timestamps go to SQL as ISO text (see ElysiumIngestRepository on zone handling). */
const ts = (d: Date): string => d.toISOString();

export type ContractsWindow = '24h' | '7d';

/**
 * Elysium analytics computed in SQL over the ingested tables (historical DB).
 * Spam txs are excluded unless a metric says otherwise. Days are UTC and the
 * current day is flagged `partial: true`. Each result is cached 60s in Redis.
 */
export class ElysiumAnalyticsService {
  private static instance: ElysiumAnalyticsService;

  public static getInstance(): ElysiumAnalyticsService {
    if (!ElysiumAnalyticsService.instance) {
      ElysiumAnalyticsService.instance = new ElysiumAnalyticsService();
    }
    return ElysiumAnalyticsService.instance;
  }

  private cached<T>(name: string, params: string, fn: () => Promise<T>): Promise<T> {
    return cacheService.getOrSet<T>(`${CACHE_PREFIX}:${name}:${params}`, fn, CACHE_TTL_S);
  }

  /** First day of a `days`-long UTC range ending today. */
  private rangeStart(now: Date, days: number): { keys: string[]; start: Date } {
    const keys = lastDays(now, days);
    return { keys, start: new Date(`${keys[0]}T00:00:00Z`) };
  }

  // ---------------------------------------------------------------------------
  // 1. status
  // ---------------------------------------------------------------------------

  public getStatus(): Promise<{ streams: Array<Record<string, unknown>> }> {
    return this.cached('status', 'v1', async () => {
      const rows = await ElysiumIngestRepository.getInstance().listStates();
      const now = Date.now();
      return {
        streams: rows.map((r) => ({
          stream: r.stream,
          cursor: r.cursor ? r.cursor.toISOString() : null,
          rows: Number(r.rows),
          backfillDone: r.backfillDone,
          lastError: r.lastError,
          lagSeconds: r.cursor ? Math.max(0, Math.round((now - r.cursor.getTime()) / 1000)) : null,
        })),
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 2. deployments
  // ---------------------------------------------------------------------------

  public getDeployments(days: number): Promise<unknown> {
    return this.cached('deployments', `d${days}`, async () => {
      const now = new Date();
      const { keys, start } = this.rangeStart(now, days);
      const since7d = new Date(now.getTime() - 7 * DAY_MS);
      const since24h = new Date(now.getTime() - DAY_MS);

      const [daily, top, trending] = await Promise.all([
        prismaHistorical.$queryRaw<Array<{ day: string; deployments: number; deployers: number }>>`
          SELECT (deployed_at AT TIME ZONE 'UTC')::date::text AS day,
                 count(*)::int AS deployments, count(DISTINCT deployer)::int AS deployers
          FROM elysium_contract WHERE deployed_at >= ${ts(start)}::timestamptz
          GROUP BY 1`,
        prismaHistorical.$queryRaw<
          Array<{ address: string; deployments: number; first_deploy: number; last_deploy: number }>
        >`
          SELECT deployer AS address, count(*)::int AS deployments,
                 (extract(epoch FROM min(deployed_at)) * 1000)::float8 AS first_deploy, (extract(epoch FROM max(deployed_at)) * 1000)::float8 AS last_deploy
          FROM elysium_contract WHERE deployed_at >= ${ts(since7d)}::timestamptz
          GROUP BY deployer ORDER BY deployments DESC, address LIMIT 15`,
        prismaHistorical.$queryRaw<
          Array<{
            address: string;
            deployer: string;
            deployed_at: number;
            callers: number;
            txs: number;
            symbol: string | null;
          }>
        >`
          WITH calls AS (
            SELECT t.to_addr, count(DISTINCT t.from_addr)::int AS callers, count(*)::int AS txs
            FROM elysium_tx t
            JOIN elysium_contract c ON c.address = t.to_addr AND c.deployed_at >= ${ts(since24h)}::timestamptz
            WHERE t.block_time >= ${ts(since24h)}::timestamptz AND NOT t.is_spam
            GROUP BY t.to_addr
          )
          SELECT c.address, c.deployer, (extract(epoch FROM c.deployed_at) * 1000)::float8 AS deployed_at, calls.callers, calls.txs, tk.symbol
          FROM calls
          JOIN elysium_contract c ON c.address = calls.to_addr
          LEFT JOIN elysium_token tk ON tk.address = c.address
          ORDER BY calls.callers DESC, calls.txs DESC, c.address LIMIT 15`,
      ]);

      const byDay = new Map(
        daily.map((r) => [toDayKey(r.day), { deployments: r.deployments, deployers: r.deployers }])
      );
      return {
        daily: fillDays(keys, byDay, () => ({ deployments: 0, deployers: 0 }), now),
        topDeployers: top.map((r) => ({
          address: r.address,
          deployments: r.deployments,
          firstDeploy: iso(r.first_deploy),
          lastDeploy: iso(r.last_deploy),
        })),
        trending: trending.map((r) => ({
          address: r.address,
          deployer: r.deployer,
          deployedAt: iso(r.deployed_at),
          callers24h: r.callers,
          txs24h: r.txs,
          symbol: r.symbol ?? null,
        })),
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 3. contracts
  // ---------------------------------------------------------------------------

  /**
   * Top 25 called contracts in the window (by non-spam txs), compared with the
   * equal preceding window. Only known contracts are ranked: deployed ones,
   * registry tokens, and 0x0000…00XX precompiles (plain EOA targets excluded).
   */
  public getContracts(window: ContractsWindow): Promise<unknown> {
    return this.cached('contracts', window, async () => {
      const spanMs = window === '7d' ? 7 * DAY_MS : DAY_MS;
      const now = new Date();
      const curStart = new Date(now.getTime() - spanMs);
      const prevStart = new Date(now.getTime() - 2 * spanMs);

      const rows = await prismaHistorical.$queryRaw<
        Array<{
          address: string;
          txs: number;
          callers: number;
          gas_used: string;
          txs_prev: number | null;
          callers_prev: number | null;
          deployer: string | null;
          deployed_at: number | null;
          name: string | null;
          symbol: string | null;
          is_token: boolean;
        }>
      >`
        WITH cur AS (
          SELECT t.to_addr AS address, count(*)::int AS txs,
                 count(DISTINCT t.from_addr)::int AS callers, sum(t.gas_used)::text AS gas_used
          FROM elysium_tx t
          WHERE t.block_time >= ${ts(curStart)}::timestamptz AND t.block_time < ${ts(now)}::timestamptz AND NOT t.is_spam
            AND t.to_addr IS NOT NULL
            AND (t.to_addr LIKE ${PRECOMPILE_LIKE}
                 OR EXISTS (SELECT 1 FROM elysium_contract c WHERE c.address = t.to_addr)
                 OR EXISTS (SELECT 1 FROM elysium_token k WHERE k.address = t.to_addr))
          GROUP BY t.to_addr
          ORDER BY txs DESC, address
          LIMIT 25
        ),
        prev AS (
          SELECT t.to_addr AS address, count(*)::int AS txs, count(DISTINCT t.from_addr)::int AS callers
          FROM elysium_tx t
          WHERE t.to_addr IN (SELECT address FROM cur)
            AND t.block_time >= ${ts(prevStart)}::timestamptz AND t.block_time < ${ts(curStart)}::timestamptz AND NOT t.is_spam
          GROUP BY t.to_addr
        )
        SELECT cur.address, cur.txs, cur.callers, cur.gas_used,
               prev.txs AS txs_prev, prev.callers AS callers_prev,
               c.deployer, (extract(epoch FROM c.deployed_at) * 1000)::float8 AS deployed_at, tk.name, tk.symbol, (tk.address IS NOT NULL) AS is_token
        FROM cur
        LEFT JOIN prev ON prev.address = cur.address
        LEFT JOIN elysium_contract c ON c.address = cur.address
        LEFT JOIN elysium_token tk ON tk.address = cur.address
        ORDER BY cur.txs DESC, cur.address`;

      return {
        window,
        rows: rows.map((r) => {
          const pre = precompileLabel(r.address);
          const kind = pre ? 'precompile' : r.is_token ? 'token' : 'contract';
          return {
            address: r.address,
            kind,
            label: pre ?? (r.is_token ? r.name : null),
            symbol: r.symbol ?? null,
            deployer: r.deployer ?? null,
            deployedAt: iso(r.deployed_at),
            txs: r.txs,
            callers: r.callers,
            gasUsed: num(r.gas_used),
            txsPrev: r.txs_prev ?? 0,
            callersPrev: r.callers_prev ?? 0,
          };
        }),
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 4. users
  // ---------------------------------------------------------------------------

  /**
   * Senders are user txs only: non-spam and not a bridge-driven tx type
   * (0x64/0x68/0x69, sent from aliased L1 addresses).
   */
  public getUsers(days: number): Promise<unknown> {
    return this.cached('users', `d${days}`, async () => {
      const now = new Date();
      const { keys } = this.rangeStart(now, days);
      const startDay = keys[0];
      const since24h = new Date(now.getTime() - DAY_MS);

      const [active, fresh, cohorts, senders] = await Promise.all([
        prismaHistorical.$queryRaw<Array<{ day: string; n: number }>>`
          SELECT day::text AS day, count(*)::int AS n FROM elysium_address_day
          WHERE day >= ${startDay}::date GROUP BY day`,
        prismaHistorical.$queryRaw<Array<{ day: string; n: number }>>`
          SELECT first_day::text AS day, count(*)::int AS n FROM elysium_address
          WHERE first_day >= ${startDay}::date GROUP BY first_day`,
        prismaHistorical.$queryRaw<Array<{ day: string; size: number; d1: number; d7: number }>>`
          SELECT a.first_day::text AS day, count(*)::int AS size,
                 count(d1.address)::int AS d1, count(d7.address)::int AS d7
          FROM elysium_address a
          LEFT JOIN elysium_address_day d1 ON d1.address = a.address AND d1.day = a.first_day + 1
          LEFT JOIN elysium_address_day d7 ON d7.address = a.address AND d7.day = a.first_day + 7
          WHERE a.first_day >= ${startDay}::date
          GROUP BY a.first_day`,
        prismaHistorical.$queryRaw<
          Array<{ address: string; txs: number; targets: number; senders: number; total: number }>
        >`
          WITH s AS (
            SELECT from_addr, count(*)::int AS txs, count(DISTINCT to_addr)::int AS targets
            FROM elysium_tx WHERE block_time >= ${ts(since24h)}::timestamptz AND NOT is_spam
              AND COALESCE(tx_type, '') NOT IN ('0x64', '0x68', '0x69')
            GROUP BY from_addr
          )
          SELECT from_addr AS address, txs, targets,
                 (count(*) OVER ())::int AS senders, (sum(txs) OVER ())::int AS total
          FROM s ORDER BY txs DESC, address LIMIT 15`,
      ]);

      const activeBy = new Map(active.map((r) => [toDayKey(r.day), r.n]));
      const newBy = new Map(fresh.map((r) => [toDayKey(r.day), r.n]));
      const merged = new Map(
        keys.map((k) => {
          const a = activeBy.get(k) ?? 0;
          const n = newBy.get(k) ?? 0;
          return [k, { active: a, new: n, returning: Math.max(0, a - n) }];
        })
      );
      const cohortBy = new Map(cohorts.map((r) => [toDayKey(r.day), r]));
      const totalTxs = senders[0]?.total ?? 0;
      const top10 = senders.slice(0, 10).reduce((s, r) => s + r.txs, 0);

      return {
        daily: fillDays(keys, merged, () => ({ active: 0, new: 0, returning: 0 }), now),
        retention: keys.map((k) => {
          const c = cohortBy.get(k);
          const size = c?.size ?? 0;
          return {
            cohortDay: k,
            size,
            d1: retentionFraction(k, 1, size, c?.d1 ?? 0, now),
            d7: retentionFraction(k, 7, size, c?.d7 ?? 0, now),
          };
        }),
        concentration24h: {
          senders: senders[0]?.senders ?? 0,
          txs: totalTxs,
          top1Share: share(senders[0]?.txs ?? 0, totalTxs),
          top10Share: share(top10, totalTxs),
        },
        topSenders24h: senders.map((r) => ({
          address: r.address,
          txs: r.txs,
          share: share(r.txs, totalTxs),
          distinctTargets: r.targets,
        })),
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 5. bridge
  // ---------------------------------------------------------------------------

  /**
   * Bridge flows by initiation day. Counts include every status (a withdrawal
   * is counted when initiated); finality uses completed transfers only.
   * HYPE = symbol 'HYPE' on the native route.
   */
  public getBridge(days: number): Promise<unknown> {
    return this.cached('bridge', `d${days}`, async () => {
      const now = new Date();
      const { keys, start } = this.rangeStart(now, days);

      const [daily, tokens, finality, bridgers] = await Promise.all([
        prismaHistorical.$queryRaw<
          Array<{ day: string; deposits: number; withdrawals: number; hype_in: number; hype_out: number }>
        >`
          SELECT (initiated_at AT TIME ZONE 'UTC')::date::text AS day,
                 count(*) FILTER (WHERE direction = 'deposit')::int AS deposits,
                 count(*) FILTER (WHERE direction = 'withdrawal')::int AS withdrawals,
                 COALESCE(sum(amount) FILTER (WHERE direction = 'deposit' AND symbol = 'HYPE' AND route = 'native'), 0)::float8 AS hype_in,
                 COALESCE(sum(amount) FILTER (WHERE direction = 'withdrawal' AND symbol = 'HYPE' AND route = 'native'), 0)::float8 AS hype_out
          FROM elysium_bridge_transfer WHERE initiated_at >= ${ts(start)}::timestamptz
          GROUP BY 1`,
        prismaHistorical.$queryRaw<
          Array<{
            symbol: string | null;
            route: string;
            deposits: number;
            withdrawals: number;
            amount_in: number;
            amount_out: number;
          }>
        >`
          SELECT symbol, route,
                 count(*) FILTER (WHERE direction = 'deposit')::int AS deposits,
                 count(*) FILTER (WHERE direction = 'withdrawal')::int AS withdrawals,
                 COALESCE(sum(amount) FILTER (WHERE direction = 'deposit'), 0)::float8 AS amount_in,
                 COALESCE(sum(amount) FILTER (WHERE direction = 'withdrawal'), 0)::float8 AS amount_out
          FROM elysium_bridge_transfer WHERE initiated_at >= ${ts(start)}::timestamptz
          GROUP BY symbol, route
          ORDER BY count(*) DESC, symbol LIMIT 25`,
        prismaHistorical.$queryRaw<
          Array<{ direction: string; completed: number; median_s: number | null; p90_s: number | null }>
        >`
          SELECT direction, count(*)::int AS completed,
                 percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_s) AS median_s,
                 percentile_cont(0.9) WITHIN GROUP (ORDER BY duration_s) AS p90_s
          FROM elysium_bridge_transfer
          WHERE initiated_at >= ${ts(start)}::timestamptz AND completed_at IS NOT NULL AND duration_s IS NOT NULL
          GROUP BY direction ORDER BY direction`,
        prismaHistorical.$queryRaw<
          Array<{ address: string; transfers: number; hype_in: number; hype_out: number }>
        >`
          SELECT from_addr AS address, count(*)::int AS transfers,
                 COALESCE(sum(amount) FILTER (WHERE direction = 'deposit' AND symbol = 'HYPE' AND route = 'native'), 0)::float8 AS hype_in,
                 COALESCE(sum(amount) FILTER (WHERE direction = 'withdrawal' AND symbol = 'HYPE' AND route = 'native'), 0)::float8 AS hype_out
          FROM elysium_bridge_transfer
          WHERE initiated_at >= ${ts(start)}::timestamptz AND from_addr IS NOT NULL
          GROUP BY from_addr ORDER BY transfers DESC, address LIMIT 15`,
      ]);

      const byDay = new Map(
        daily.map((r) => [
          toDayKey(r.day),
          {
            deposits: r.deposits,
            withdrawals: r.withdrawals,
            hypeIn: num(r.hype_in),
            hypeOut: num(r.hype_out),
            netHype: num(r.hype_in) - num(r.hype_out),
          },
        ])
      );
      return {
        daily: fillDays(
          keys,
          byDay,
          () => ({ deposits: 0, withdrawals: 0, hypeIn: 0, hypeOut: 0, netHype: 0 }),
          now
        ),
        tokens: tokens.map((r) => ({
          symbol: r.symbol,
          route: r.route,
          deposits: r.deposits,
          withdrawals: r.withdrawals,
          amountIn: num(r.amount_in),
          amountOut: num(r.amount_out),
        })),
        finality: finality.map((r) => ({
          direction: r.direction,
          completed: r.completed,
          medianS: r.median_s === null ? null : num(r.median_s),
          p90S: r.p90_s === null ? null : num(r.p90_s),
        })),
        topBridgers: bridgers.map((r) => ({
          address: r.address,
          transfers: r.transfers,
          hypeIn: num(r.hype_in),
          hypeOut: num(r.hype_out),
        })),
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 6. economics
  // ---------------------------------------------------------------------------

  /**
   * Daily tx economics. `txs` = non-spam txs, `spamTxs` = spam txs (so the
   * ingested total is txs + spamTxs), `failedTxs` = failed non-spam txs,
   * `bridgeTxs` = the part of `txs` that is bridge-driven (types 0x64/0x68/0x69;
   * txs - bridgeTxs matches the provider's user_transactions).
   * Fees cover ALL ingested txs (spam included), in HYPE (fee_wei / 1e18).
   * `totals.txs` counts every ingested tx (same basis as `totals.feesHype`).
   * No fee split is applied here.
   */
  public getEconomics(days: number): Promise<unknown> {
    return this.cached('economics', `d${days}`, async () => {
      const now = new Date();
      const { keys, start } = this.rangeStart(now, days);

      const rows = await prismaHistorical.$queryRaw<
        Array<{ day: string; txs: number; spam: number; failed: number; bridge: number; fees: number }>
      >`
        SELECT (block_time AT TIME ZONE 'UTC')::date::text AS day,
               count(*) FILTER (WHERE NOT is_spam)::int AS txs,
               count(*) FILTER (WHERE is_spam)::int AS spam,
               count(*) FILTER (WHERE NOT is_spam AND NOT success)::int AS failed,
               count(*) FILTER (WHERE NOT is_spam AND tx_type IN ('0x64', '0x68', '0x69'))::int AS bridge,
               (COALESCE(sum(fee_wei), 0) / 1e18)::float8 AS fees
        FROM elysium_tx WHERE block_time >= ${ts(start)}::timestamptz
        GROUP BY 1`;

      const byDay = new Map(
        rows.map((r) => {
          const total = r.txs + r.spam;
          const fees = num(r.fees);
          return [
            toDayKey(r.day),
            {
              txs: r.txs,
              spamTxs: r.spam,
              failedTxs: r.failed,
              bridgeTxs: r.bridge,
              feesHype: fees,
              avgFeeHype: total > 0 ? fees / total : 0,
            },
          ];
        })
      );
      const daily = fillDays(
        keys,
        byDay,
        () => ({ txs: 0, spamTxs: 0, failedTxs: 0, bridgeTxs: 0, feesHype: 0, avgFeeHype: 0 }),
        now
      );
      return {
        daily,
        totals: {
          feesHype: daily.reduce((s, d) => s + d.feesHype, 0),
          txs: daily.reduce((s, d) => s + d.txs + d.spamTxs, 0),
        },
      };
    });
  }
}

