import { HypeDexerElysiumIndexerClient } from '../../clients/hypedexer/rest/elysium/elysium-indexer.client';
import type {
  ElysiumIngestPageQuery,
  ElysiumIngestPath,
} from '../../clients/hypedexer/rest/elysium/elysium-indexer.client';
import { withDistributedLock } from '../../utils/distributedLock';
import { logDeduplicator } from '../../utils/logDeduplicator';
import { rawLogger } from '../../utils/logger';
import { ElysiumIngestRepository, ElysiumStream } from '../../repositories/prisma/prisma.elysium.repository';
import {
  dedupeBy,
  ELYSIUM_GENESIS,
  HOUR_MS,
  MINUTE_MS,
  normalizeBridgeTransfer,
  normalizeToken,
  normalizeTx,
  planWindow,
  toUpstreamTime,
  BridgeRow,
  TokenRow,
  TxRow,
} from './elysium-ingest.util';

const PAGE_SIZE = 1000;
/** Hard stop per window: 200k rows/hour is ~20x the measured peak. */
const MAX_PAGES_PER_WINDOW = 200;
/** At most ~2 upstream calls per second across every stream. */
const MIN_CALL_GAP_MS = 500;
/** Work budget per tick so a lock never outlives its TTL. */
const TICK_BUDGET_MS = 40_000;
const LOCK_TTL_S = 120;

const TX_LIVE_INTERVAL_MS = 30_000;
const TX_STEP_MS = HOUR_MS;
const TX_OVERLAP_MS = 120_000;
const TX_SETTLE_MS = 15_000;

const BRIDGE_LIVE_INTERVAL_MS = 60_000;
const BRIDGE_LIVE_WINDOW_MS = 15 * MINUTE_MS;
const BRIDGE_WIDE_EVERY_MS = 15 * MINUTE_MS;
const BRIDGE_WIDE_WINDOW_MS = 26 * HOUR_MS;
/** Withdrawals settle on HyperEVM after hours to days; sweep executed ones over 8d. */
const BRIDGE_EXECUTED_SWEEP_MS = 8 * 24 * HOUR_MS;
const BRIDGE_BACKFILL_STEP_MS = 6 * HOUR_MS;

const TOKENS_INTERVAL_MS = 15 * MINUTE_MS;

/** Serialises upstream calls with a minimum gap (shared by all streams). */
class CallThrottle {
  private nextAt = 0;
  private chain: Promise<void> = Promise.resolve();

  public wait(): Promise<void> {
    const turn = this.chain.then(async () => {
      const delay = this.nextAt - Date.now();
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      this.nextAt = Date.now() + MIN_CALL_GAP_MS;
    });
    this.chain = turn.catch(() => undefined);
    return turn;
  }
}

class IngestStoppedError extends Error {
  constructor() {
    super('Elysium ingestion stopped');
    this.name = 'IngestStoppedError';
  }
}

/**
 * Elysium ingestion: pulls raw txs, bridge transfers and the token registry
 * from the provider's REST API into the historical DB.
 *
 * - tx: walks from genesis in 1h windows (backfill), then every 30s re-reads
 *   [cursor - 120s, now - 15s]. System txs are skipped, spam is kept + flagged.
 * - bridge: one-time backfill from genesis, then last 15 min every 60s plus a
 *   26h window (status changes) and an executed-withdrawals sweep every 15 min.
 * - tokens: full ERC-20 listing every 15 min.
 *
 * Each stream is a self-rescheduling loop (single flight by construction),
 * guarded by a Redis lock, and never throws: failures are recorded in
 * elysium_ingest_state.last_error and the stream backs off.
 */
export class ElysiumIngestionService {
  private static instance: ElysiumIngestionService;

  private readonly client = HypeDexerElysiumIndexerClient.getInstance();
  private readonly repo = ElysiumIngestRepository.getInstance();
  private readonly throttle = new CallThrottle();

  private stopped = true;
  private timers = new Map<ElysiumStream, NodeJS.Timeout>();
  private failures = new Map<ElysiumStream, number>();
  private lastBridgeWideAt = 0;
  private backfillWindows = 0;

  public static getInstance(): ElysiumIngestionService {
    if (!ElysiumIngestionService.instance) {
      ElysiumIngestionService.instance = new ElysiumIngestionService();
    }
    return ElysiumIngestionService.instance;
  }

  public static isEnabled(): boolean {
    return (process.env.ELYSIUM_INGEST_ENABLED ?? 'true').trim().toLowerCase() !== 'false';
  }

  public startPolling(): void {
    if (!ElysiumIngestionService.isEnabled()) {
      logDeduplicator.info('Elysium ingestion disabled by ELYSIUM_INGEST_ENABLED');
      return;
    }
    if (!this.stopped) return;
    this.stopped = false;
    this.schedule('tx', 0, () => this.txTick());
    this.schedule('bridge', 5_000, () => this.bridgeTick());
    this.schedule('tokens', 10_000, () => this.tokensTick());
    logDeduplicator.info('Elysium ingestion started');
  }

  public stopPolling(): void {
    this.stopped = true;
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }

  // ---------------------------------------------------------------------------
  // Loop plumbing
  // ---------------------------------------------------------------------------

  /** Runs `tick` after `delayMs`; tick resolves to the delay until its next run. */
  private schedule(stream: ElysiumStream, delayMs: number, tick: () => Promise<number>): void {
    if (this.stopped) return;
    const timer = setTimeout(() => {
      void this.runTick(stream, tick).then((next) => this.schedule(stream, next, tick));
    }, delayMs);
    timer.unref?.();
    this.timers.set(stream, timer);
  }

  private async runTick(stream: ElysiumStream, tick: () => Promise<number>): Promise<number> {
    let next = 0;
    try {
      const ran = await withDistributedLock(`poll:elysium-ingest:${stream}`, LOCK_TTL_S, async () => {
        next = await tick();
      });
      if (!ran) next = this.baseInterval(stream);
      this.failures.set(stream, 0);
      return next;
    } catch (error) {
      if (error instanceof IngestStoppedError) return 0;
      const count = (this.failures.get(stream) ?? 0) + 1;
      this.failures.set(stream, count);
      const message = error instanceof Error ? error.message : String(error);
      try {
        await this.repo.recordError(stream, message);
      } catch {
        // DB unreachable: the warn below is the only trace, and that is fine.
      }
      logDeduplicator.warn('Elysium ingest: stream tick failed', {
        stream,
        errorType: error instanceof Error ? error.name : typeof error,
      });
      return this.baseInterval(stream) * Math.min(2 ** count, 10);
    }
  }

  private baseInterval(stream: ElysiumStream): number {
    if (stream === 'tx') return TX_LIVE_INTERVAL_MS;
    if (stream === 'bridge') return BRIDGE_LIVE_INTERVAL_MS;
    return TOKENS_INTERVAL_MS;
  }

  private ensureRunning(): void {
    if (this.stopped) throw new IngestStoppedError();
  }

  /** Pages a list endpoint until a short page, handing each page to `onPage`. */
  private async pageAll(
    path: ElysiumIngestPath,
    params: Record<string, string | boolean>,
    onPage: (rows: unknown[]) => Promise<void>
  ): Promise<void> {
    for (let page = 0; page < MAX_PAGES_PER_WINDOW; page++) {
      this.ensureRunning();
      await this.throttle.wait();
      const query: ElysiumIngestPageQuery = { ...params, limit: PAGE_SIZE, offset: page * PAGE_SIZE };
      const rows = await this.client.fetchIngestPage(path, query);
      await onPage(rows);
      if (rows.length < PAGE_SIZE) return;
    }
    throw new Error('Elysium ingest: window exceeded the page cap');
  }

  // ---------------------------------------------------------------------------
  // tx stream
  // ---------------------------------------------------------------------------

  private async txTick(): Promise<number> {
    const deadline = Date.now() + TICK_BUDGET_MS;
    const state = await this.repo.getState('tx');
    let cursor = state?.cursor ?? null;
    let backfillDone = state?.backfillDone ?? false;

    while (Date.now() < deadline) {
      this.ensureRunning();
      const w = planWindow({
        cursor,
        backfillDone,
        now: new Date(),
        genesis: ELYSIUM_GENESIS,
        stepMs: TX_STEP_MS,
        overlapMs: TX_OVERLAP_MS,
        settleMs: TX_SETTLE_MS,
      });
      if (!w) return TX_LIVE_INTERVAL_MS;

      let inserted = 0;
      await this.pageAll(
        '/transactions',
        {
          start_time: toUpstreamTime(w.start),
          end_time: toUpstreamTime(w.end),
          include_spam: true,
          include_system: false,
        },
        async (raw) => {
          const rows = dedupeBy(
            raw.map(normalizeTx).filter((r): r is TxRow => r !== null),
            (r) => r.tx_hash
          );
          inserted += (await this.repo.insertTxs(rows)).inserted;
        }
      );

      const finishesBackfill = !backfillDone && w.caughtUp;
      await this.repo.advance('tx', {
        cursor: w.end,
        addRows: inserted,
        ...(finishesBackfill ? { backfillDone: true } : {}),
      });
      cursor = w.end;

      if (!backfillDone) {
        this.backfillWindows++;
        if (finishesBackfill) {
          backfillDone = true;
          void rawLogger.info('Elysium ingest: tx backfill complete');
        } else if (this.backfillWindows % 24 === 0) {
          void rawLogger.info('Elysium ingest: tx backfill progress', { cursor: w.end.toISOString() });
        }
      }
      if (w.caughtUp) return TX_LIVE_INTERVAL_MS;
    }
    // Budget spent but still behind: continue right away.
    return 0;
  }

  // ---------------------------------------------------------------------------
  // bridge stream
  // ---------------------------------------------------------------------------

  private async ingestBridgeWindow(params: Record<string, string>): Promise<number> {
    let changed = 0;
    await this.pageAll('/bridge/transfers', params, async (raw) => {
      const rows = dedupeBy(
        raw.map(normalizeBridgeTransfer).filter((r): r is BridgeRow => r !== null),
        (r) => r.transfer_id
      );
      changed += await this.repo.upsertBridgeTransfers(rows);
    });
    return changed;
  }

  private async bridgeTick(): Promise<number> {
    const deadline = Date.now() + TICK_BUDGET_MS;
    const state = await this.repo.getState('bridge');

    if (!state?.backfillDone) {
      let cursor = state?.cursor ?? null;
      while (Date.now() < deadline) {
        this.ensureRunning();
        const w = planWindow({
          cursor,
          backfillDone: false,
          now: new Date(),
          genesis: ELYSIUM_GENESIS,
          stepMs: BRIDGE_BACKFILL_STEP_MS,
          overlapMs: 0,
          settleMs: 0,
        });
        if (!w) {
          await this.repo.advance('bridge', { addRows: 0, backfillDone: true });
          break;
        }
        const changed = await this.ingestBridgeWindow({
          start_time: toUpstreamTime(w.start),
          end_time: toUpstreamTime(w.end),
        });
        await this.repo.advance('bridge', {
          cursor: w.end,
          addRows: changed,
          ...(w.caughtUp ? { backfillDone: true } : {}),
        });
        cursor = w.end;
        if (w.caughtUp) {
          void rawLogger.info('Elysium ingest: bridge backfill complete');
          break;
        }
      }
      return state?.backfillDone ? BRIDGE_LIVE_INTERVAL_MS : 0;
    }

    const now = new Date();
    const wide = now.getTime() - this.lastBridgeWideAt >= BRIDGE_WIDE_EVERY_MS;
    const windowMs = wide ? BRIDGE_WIDE_WINDOW_MS : BRIDGE_LIVE_WINDOW_MS;
    let changed = await this.ingestBridgeWindow({
      start_time: toUpstreamTime(new Date(now.getTime() - windowMs)),
      end_time: toUpstreamTime(now),
    });
    if (wide) {
      changed += await this.ingestBridgeWindow({
        direction: 'withdrawal',
        status: 'executed',
        start_time: toUpstreamTime(new Date(now.getTime() - BRIDGE_EXECUTED_SWEEP_MS)),
        end_time: toUpstreamTime(now),
      });
      this.lastBridgeWideAt = now.getTime();
    }
    await this.repo.advance('bridge', { cursor: now, addRows: changed });
    return BRIDGE_LIVE_INTERVAL_MS;
  }

  // ---------------------------------------------------------------------------
  // tokens stream
  // ---------------------------------------------------------------------------

  private async tokensTick(): Promise<number> {
    let upserted = 0;
    await this.pageAll('/tokens', { standard: 'erc20' }, async (raw) => {
      const rows = dedupeBy(
        raw.map(normalizeToken).filter((r): r is TokenRow => r !== null),
        (r) => r.address
      );
      upserted += await this.repo.upsertTokens(rows);
    });
    // rows = size of the latest listing (a snapshot), not a running total.
    await this.repo.advance('tokens', { cursor: new Date(), setRows: upserted, backfillDone: true });
    return TOKENS_INTERVAL_MS;
  }
}
