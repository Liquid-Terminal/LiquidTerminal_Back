import { prismaHistorical } from '../../core/prisma.historical.service';
import { BRIDGE_TX_TYPES } from '../../services/elysium/elysium-ingest.util';
import type { BridgeRow, TokenRow, TxRow } from '../../services/elysium/elysium-ingest.util';

/** Constant SQL list of the bridge tx types (no user input involved). */
const BRIDGE_TYPES_SQL = BRIDGE_TX_TYPES.map((t) => `'${t}'`).join(', ');

export type ElysiumStream = 'tx' | 'bridge' | 'tokens';

export interface ElysiumIngestStateRow {
  stream: string;
  cursor: Date | null;
  rows: bigint;
  backfillDone: boolean;
  lastError: string | null;
  updatedAt: Date;
}

/**
 * Write side of the Elysium tables (historical DB). Every statement is an
 * idempotent upsert: replaying a window never double counts.
 */
export class ElysiumIngestRepository {
  private static instance: ElysiumIngestRepository;

  public static getInstance(): ElysiumIngestRepository {
    if (!ElysiumIngestRepository.instance) {
      ElysiumIngestRepository.instance = new ElysiumIngestRepository();
    }
    return ElysiumIngestRepository.instance;
  }

  /**
   * Inserts txs and, in the same statement, maintains contracts, first-seen
   * addresses and per-address daily counts (user txs only: non-spam and not a
   * bridge-driven tx type) from the rows that were actually
   * inserted (RETURNING). A replayed row conflicts, is not returned, and so is
   * never counted twice; a crash rolls back the whole statement.
   */
  public async insertTxs(rows: TxRow[]): Promise<{ inserted: number; contracts: number }> {
    if (rows.length === 0) return { inserted: 0, contracts: 0 };
    const result = await prismaHistorical.$queryRawUnsafe<Array<{ inserted: number; contracts: number }>>(
      `
      WITH src AS (
        SELECT * FROM jsonb_to_recordset($1::jsonb) AS r(
          tx_hash text, block_number bigint, block_time timestamptz, from_addr text, to_addr text,
          contract_address text, method_id text, tx_type text, gas_used bigint, fee_wei numeric,
          success boolean, is_spam boolean)
      ),
      ins AS (
        INSERT INTO elysium_tx (tx_hash, block_number, block_time, from_addr, to_addr,
          contract_address, method_id, tx_type, gas_used, fee_wei, success, is_spam)
        SELECT tx_hash, block_number, block_time, from_addr, to_addr,
          contract_address, method_id, tx_type, gas_used, fee_wei, success, is_spam
        FROM src
        ON CONFLICT (tx_hash) DO NOTHING
        RETURNING tx_hash, block_number, block_time, from_addr, contract_address, is_spam,
          (NOT is_spam AND COALESCE(tx_type, '') NOT IN (${BRIDGE_TYPES_SQL})) AS is_user
      ),
      c AS (
        INSERT INTO elysium_contract (address, deployer, deploy_tx, deployed_at, block_number)
        SELECT DISTINCT ON (contract_address) contract_address, from_addr, tx_hash, block_time, block_number
        FROM ins WHERE contract_address IS NOT NULL
        ORDER BY contract_address, block_time
        ON CONFLICT (address) DO NOTHING
        RETURNING 1
      ),
      a AS (
        INSERT INTO elysium_address (address, first_seen, first_day)
        SELECT from_addr, min(block_time), (min(block_time) AT TIME ZONE 'UTC')::date
        FROM ins WHERE is_user GROUP BY from_addr
        ON CONFLICT (address) DO UPDATE
          SET first_seen = EXCLUDED.first_seen, first_day = EXCLUDED.first_day
          WHERE EXCLUDED.first_seen < elysium_address.first_seen
        RETURNING 1
      ),
      d AS (
        INSERT INTO elysium_address_day (address, day, tx_count)
        SELECT from_addr, (block_time AT TIME ZONE 'UTC')::date, count(*)::int
        FROM ins WHERE is_user GROUP BY 1, 2
        ON CONFLICT (address, day) DO UPDATE
          SET tx_count = elysium_address_day.tx_count + EXCLUDED.tx_count
        RETURNING 1
      )
      SELECT (SELECT count(*) FROM ins)::int AS inserted,
             (SELECT count(*) FROM c)::int AS contracts,
             (SELECT count(*) FROM a)::int AS addresses,
             (SELECT count(*) FROM d)::int AS address_days
      `,
      JSON.stringify(rows)
    );
    return { inserted: result[0]?.inserted ?? 0, contracts: result[0]?.contracts ?? 0 };
  }

  /** Upserts bridge transfers; only rows whose tracked fields changed are rewritten. */
  public async upsertBridgeTransfers(rows: BridgeRow[]): Promise<number> {
    if (rows.length === 0) return 0;
    const result = await prismaHistorical.$queryRawUnsafe<Array<{ n: number }>>(
      `
      WITH up AS (
        INSERT INTO elysium_bridge_transfer (transfer_id, direction, asset, route, status, symbol,
          decimals, from_addr, to_addr, amount, l1_tx_hash, l2_tx_hash, initiated_at, completed_at,
          duration_s, updated_at)
        SELECT transfer_id, direction, asset, route, status, symbol, decimals, from_addr, to_addr,
          amount, l1_tx_hash, l2_tx_hash, initiated_at, completed_at, duration_s, now()
        FROM jsonb_to_recordset($1::jsonb) AS r(
          transfer_id text, direction text, asset text, route text, status text, symbol text,
          decimals int, from_addr text, to_addr text, amount numeric, l1_tx_hash text,
          l2_tx_hash text, initiated_at timestamptz, completed_at timestamptz, duration_s float8)
        ON CONFLICT (transfer_id) DO UPDATE SET
          status = EXCLUDED.status,
          symbol = EXCLUDED.symbol,
          decimals = EXCLUDED.decimals,
          from_addr = EXCLUDED.from_addr,
          to_addr = EXCLUDED.to_addr,
          amount = EXCLUDED.amount,
          l1_tx_hash = EXCLUDED.l1_tx_hash,
          l2_tx_hash = EXCLUDED.l2_tx_hash,
          completed_at = EXCLUDED.completed_at,
          duration_s = EXCLUDED.duration_s,
          updated_at = now()
        WHERE (elysium_bridge_transfer.status, elysium_bridge_transfer.completed_at,
               elysium_bridge_transfer.l1_tx_hash, elysium_bridge_transfer.l2_tx_hash,
               elysium_bridge_transfer.amount, elysium_bridge_transfer.duration_s)
          IS DISTINCT FROM
              (EXCLUDED.status, EXCLUDED.completed_at, EXCLUDED.l1_tx_hash, EXCLUDED.l2_tx_hash,
               EXCLUDED.amount, EXCLUDED.duration_s)
        RETURNING 1
      )
      SELECT count(*)::int AS n FROM up
      `,
      JSON.stringify(rows)
    );
    return result[0]?.n ?? 0;
  }

  /** Upserts the token registry snapshot. */
  public async upsertTokens(rows: TokenRow[]): Promise<number> {
    if (rows.length === 0) return 0;
    const result = await prismaHistorical.$queryRawUnsafe<Array<{ n: number }>>(
      `
      WITH up AS (
        INSERT INTO elysium_token (address, standard, name, symbol, decimals, origin, first_seen,
          transfer_count, updated_at)
        SELECT address, standard, name, symbol, decimals, origin, first_seen, transfer_count, now()
        FROM jsonb_to_recordset($1::jsonb) AS r(
          address text, standard text, name text, symbol text, decimals int, origin text,
          first_seen timestamptz, transfer_count bigint)
        ON CONFLICT (address) DO UPDATE SET
          standard = EXCLUDED.standard,
          name = EXCLUDED.name,
          symbol = EXCLUDED.symbol,
          decimals = EXCLUDED.decimals,
          origin = EXCLUDED.origin,
          first_seen = COALESCE(elysium_token.first_seen, EXCLUDED.first_seen),
          transfer_count = EXCLUDED.transfer_count,
          updated_at = now()
        RETURNING 1
      )
      SELECT count(*)::int AS n FROM up
      `,
      JSON.stringify(rows)
    );
    return result[0]?.n ?? 0;
  }

  /**
   * Timestamps cross the driver as ISO text / epoch millis on purpose: the
   * Prisma pg adapter writes Date values as zone-less wall clock, which a
   * non-UTC database session would then misread.
   */
  private async selectStates(stream: ElysiumStream | null): Promise<ElysiumIngestStateRow[]> {
    const rows = await prismaHistorical.$queryRawUnsafe<
      Array<{
        stream: string;
        cursor_ms: number | null;
        rows: string;
        backfill_done: boolean;
        last_error: string | null;
        updated_ms: number;
      }>
    >(
      `SELECT stream, (extract(epoch FROM cursor) * 1000)::float8 AS cursor_ms, rows::text AS rows,
              backfill_done, last_error, (extract(epoch FROM updated_at) * 1000)::float8 AS updated_ms
       FROM elysium_ingest_state
       WHERE $1::text IS NULL OR stream = $1::text
       ORDER BY stream`,
      stream
    );
    return rows.map((r) => ({
      stream: r.stream,
      cursor: r.cursor_ms === null ? null : new Date(Number(r.cursor_ms)),
      rows: BigInt(r.rows),
      backfillDone: r.backfill_done,
      lastError: r.last_error,
      updatedAt: new Date(Number(r.updated_ms)),
    }));
  }

  public async getState(stream: ElysiumStream): Promise<ElysiumIngestStateRow | null> {
    return (await this.selectStates(stream))[0] ?? null;
  }

  public async listStates(): Promise<ElysiumIngestStateRow[]> {
    return this.selectStates(null);
  }

  /**
   * Advances the watermark after a fully ingested window and clears the last
   * error. `addRows` increments the counter, `setRows` replaces it.
   */
  public async advance(
    stream: ElysiumStream,
    patch: { cursor?: Date; addRows?: number; setRows?: number; backfillDone?: boolean }
  ): Promise<void> {
    const rows = String(Math.trunc(patch.setRows ?? patch.addRows ?? 0));
    await prismaHistorical.$executeRawUnsafe(
      `INSERT INTO elysium_ingest_state (stream, cursor, rows, backfill_done, last_error, updated_at)
       VALUES ($1::text, $2::timestamptz, $3::bigint, COALESCE($4::boolean, false), NULL, now())
       ON CONFLICT (stream) DO UPDATE SET
         cursor = COALESCE(EXCLUDED.cursor, elysium_ingest_state.cursor),
         rows = CASE WHEN $5::boolean THEN EXCLUDED.rows ELSE elysium_ingest_state.rows + EXCLUDED.rows END,
         backfill_done = COALESCE($4::boolean, elysium_ingest_state.backfill_done),
         last_error = NULL,
         updated_at = now()`,
      stream,
      patch.cursor ? patch.cursor.toISOString() : null,
      rows,
      patch.backfillDone ?? null,
      patch.setRows !== undefined
    );
  }

  /** Records the last error without moving the watermark. */
  public async recordError(stream: ElysiumStream, message: string): Promise<void> {
    await prismaHistorical.$executeRawUnsafe(
      `INSERT INTO elysium_ingest_state (stream, last_error, updated_at)
       VALUES ($1::text, $2::text, now())
       ON CONFLICT (stream) DO UPDATE SET last_error = EXCLUDED.last_error, updated_at = now()`,
      stream,
      message.slice(0, 1000)
    );
  }
}
