import { CircuitBreakerService } from '../../../../core/circuit.breaker.service';
import { logDeduplicator } from '../../../../utils/logDeduplicator';
import { CompletedTrade, HypeDexerCompletedTrade } from '../../../../types/wallet-events.types';
import { HYPEDEXER_API_URL, hypedexerJsonHeaders } from '../shared/hypedexer-api.config';
import { HypeDexerBaseClient } from '../shared/hypedexer-base.client';

/**
 * Callback type for completed trade events
 */
export type CompletedTradeCallback = (trades: CompletedTrade[]) => void;

const POLL_INTERVAL_MS = 5_000;
/**
 * HypeDexer lists a trade 0.5–3.6 s after it closes (measured over 10.7k trades)
 * and truncates `start_time` to the second, so each request re-reads this much
 * before the newest `end_time` already delivered; the seen-set drops the repeats.
 */
const OVERLAP_MS = 10_000;
/** After an outage, trades that closed longer ago than this are not alerted any more. */
const MAX_CATCH_UP_MS = 5 * 60_000;
const PAGE_SIZE = 500;
/** ~6 trades/s network-wide: a full catch-up window fits in 4 pages. */
const MAX_PAGES_PER_POLL = 10;
const REQUEST_TIMEOUT_MS = 10_000;
/** While HypeDexer fails, attempts back off up to POLL_INTERVAL_MS × this (60 s). */
const MAX_BACKOFF_MULTIPLIER = 12;

/** `end_time` comes without a zone designator but is UTC; Date.parse would read it as local time. */
function parseUtcMs(iso: string): number {
  return Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso) ? iso : `${iso}Z`);
}

function finiteOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * HypeDexer Completed Trades Poller
 *
 * HypeDexer dropped the `completed_trades` WebSocket channel (2026-09:
 * "Unsupported subscription"). The same network-wide trades are still listed by
 * GET /completed-trades/, so this polls that list and hands every trade to the
 * callbacks once, as the stream did: every trade that closes from OVERLAP_MS
 * before start() on (the sent-alert table dedups across restarts).
 *
 * Own circuit breaker: user traffic on /indexer/completed-trades and this loop
 * must not open each other's breaker. No retry inside a poll — the next poll is
 * the retry, backed off while HypeDexer fails.
 */
export class HypeDexerCompletedTradesPoller extends HypeDexerBaseClient {
  private static instance: HypeDexerCompletedTradesPoller;

  private readonly circuitBreaker = CircuitBreakerService.getInstance('hypedexer-completed-trades-feed');
  private readonly tradeCallbacks: Set<CompletedTradeCallback> = new Set();

  private running = false;
  private paused = false;
  /** Bumped by every start() so a poll still in flight from a previous run stops its loop. */
  private runId = 0;
  private timer: NodeJS.Timeout | null = null;
  private consecutiveFailures = 0;
  /** Newest `end_time` delivered (ms); each request starts OVERLAP_MS before it. */
  private cursorMs = 0;
  /** Bumped whenever the cursor is reset: rows fetched for an older cursor are discarded. */
  private cursorEpoch = 0;
  /** trade_id → end_time (ms) of the delivered trades a request can still return. */
  private readonly seen = new Map<string, number>();

  private constructor() {
    super(HYPEDEXER_API_URL, hypedexerJsonHeaders);
  }

  public static getInstance(): HypeDexerCompletedTradesPoller {
    if (!HypeDexerCompletedTradesPoller.instance) {
      HypeDexerCompletedTradesPoller.instance = new HypeDexerCompletedTradesPoller();
    }
    return HypeDexerCompletedTradesPoller.instance;
  }

  /**
   * Start polling (idempotent).
   */
  public start(): void {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.runId += 1;
    this.consecutiveFailures = 0;
    this.resetCursor();
    this.scheduleNext(this.runId, 0);
    logDeduplicator.info('HypeDexerCompletedTradesPoller: Started');
  }

  /**
   * Stop polling and drop the callbacks.
   */
  public stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.tradeCallbacks.clear();
    this.cursorEpoch += 1;
    this.seen.clear();
  }

  /**
   * Skip the requests while nobody can be alerted. Resuming starts from now:
   * trades that closed while paused are not replayed.
   */
  public setPaused(paused: boolean): void {
    if (paused === this.paused) return;
    this.paused = paused;
    if (!paused) this.resetCursor();
    logDeduplicator.info('HypeDexerCompletedTradesPoller: ' + (paused ? 'Paused' : 'Resumed'));
  }

  /**
   * Register a callback for completed trade events
   * Returns an unsubscribe function
   */
  public onCompletedTrade(callback: CompletedTradeCallback): () => void {
    this.tradeCallbacks.add(callback);
    return () => {
      this.tradeCallbacks.delete(callback);
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private resetCursor(): void {
    this.cursorEpoch += 1;
    this.cursorMs = Date.now();
    this.seen.clear();
  }

  private scheduleNext(runId: number, delayMs: number): void {
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.tick(runId);
    }, delayMs);
  }

  private async tick(runId: number): Promise<void> {
    if (!this.running || runId !== this.runId) return;

    if (!this.paused && this.tradeCallbacks.size > 0) {
      try {
        await this.poll();
        this.consecutiveFailures = 0;
      } catch (error) {
        this.consecutiveFailures += 1;
        logDeduplicator.warn('HypeDexerCompletedTradesPoller: poll failed', {
          error: error instanceof Error ? error.message : String(error),
          consecutiveFailures: this.consecutiveFailures,
        });
      }
    }

    if (!this.running || runId !== this.runId) return;
    const multiplier = Math.min(2 ** this.consecutiveFailures, MAX_BACKOFF_MULTIPLIER);
    this.scheduleNext(runId, POLL_INTERVAL_MS * multiplier);
  }

  /**
   * Fetch every trade listed since the cursor (minus the overlap) and deliver
   * the ones not delivered yet. The cursor only moves once a poll has fully
   * succeeded, so a failed poll is retried from the same point.
   */
  private async poll(): Promise<void> {
    const catchUpFloor = Date.now() - MAX_CATCH_UP_MS;
    if (this.cursorMs < catchUpFloor) {
      logDeduplicator.warn('HypeDexerCompletedTradesPoller: behind the catch-up window, older trades skipped', {
        skippedMs: catchUpFloor - this.cursorMs,
      });
      this.cursorMs = catchUpFloor;
    }
    const epoch = this.cursorEpoch;
    const since = new Date(this.cursorMs - OVERLAP_MS).toISOString();

    const rows: unknown[] = [];
    for (let page = 0; page < MAX_PAGES_PER_POLL; page++) {
      const pageRows = await this.fetchPage(since, page * PAGE_SIZE);
      rows.push(...pageRows);
      if (pageRows.length < PAGE_SIZE) break;
    }
    // Resumed, stopped or restarted meanwhile: these rows belong to the old cursor.
    if (epoch !== this.cursorEpoch) return;

    const fresh: CompletedTrade[] = [];
    let newestMs = this.cursorMs;
    let invalid = 0;
    for (const row of rows) {
      const parsed = HypeDexerCompletedTradesPoller.parseRow(row);
      if (!parsed) {
        invalid += 1;
        continue;
      }
      if (this.seen.has(parsed.trade.tradeId)) continue;
      this.seen.set(parsed.trade.tradeId, parsed.endMs);
      if (parsed.endMs > newestMs) newestMs = parsed.endMs;
      fresh.push(parsed.trade);
    }
    if (invalid > 0) {
      logDeduplicator.warn('HypeDexerCompletedTradesPoller: malformed rows skipped', { count: invalid });
    }

    this.cursorMs = newestMs;
    // `start_time` is truncated to the second: nothing older than this can come back.
    const oldestReturnable = this.cursorMs - OVERLAP_MS - 1_000;
    for (const [tradeId, endMs] of this.seen) {
      if (endMs < oldestReturnable) this.seen.delete(tradeId);
    }

    if (fresh.length > 0) this.emit(fresh);
  }

  private async fetchPage(since: string, offset: number): Promise<unknown[]> {
    const query = new URLSearchParams({
      start_time: since,
      sort_by: 'end_time',
      sort_dir: 'ASC',
      limit: String(PAGE_SIZE),
      offset: String(offset),
      do_count: 'false',
    });
    const data = await this.circuitBreaker.execute(() =>
      this.getSingleAttemptUnwrapped<unknown>(`/completed-trades/?${query.toString()}`, REQUEST_TIMEOUT_MS)
    );
    if (!Array.isArray(data)) {
      throw new Error('Unexpected /completed-trades/ payload (not a list)');
    }
    return data;
  }

  private emit(trades: CompletedTrade[]): void {
    for (const callback of this.tradeCallbacks) {
      try {
        callback(trades);
      } catch (error) {
        logDeduplicator.error('HypeDexerCompletedTradesPoller: Callback error', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Normalize a HypeDexer completed trade to the internal format
   * - camelCase field names
   * - user address always lowercase
   * Returns null for a row without a trade id, a user or a parseable end time.
   */
  private static parseRow(row: unknown): { trade: CompletedTrade; endMs: number } | null {
    if (typeof row !== 'object' || row === null) return null;
    const raw = row as Partial<HypeDexerCompletedTrade>;
    if (typeof raw.trade_id !== 'string' || typeof raw.user !== 'string' || typeof raw.end_time !== 'string') {
      return null;
    }
    const endMs = parseUtcMs(raw.end_time);
    if (!Number.isFinite(endMs)) return null;

    const pnlRealized = finiteOrZero(raw.pnl_realized);
    const positionValue = finiteOrZero(raw.position_value);
    return {
      endMs,
      trade: {
        tradeId: raw.trade_id,
        user: raw.user.toLowerCase(),
        coin: String(raw.coin ?? ''),
        direction: raw.direction as CompletedTrade['direction'],
        pnlRealized,
        // The REST rows carry no pnl_percentage (the WS frames did): realized PnL
        // over the entry notional.
        pnlPercentage: positionValue > 0 ? (pnlRealized / positionValue) * 100 : 0,
        positionValue,
        entryPrice: finiteOrZero(raw.entry_price),
        exitPrice: finiteOrZero(raw.exit_price),
        totalFees: finiteOrZero(raw.total_fees),
        totalVolume: finiteOrZero(raw.total_volume),
        durationSeconds: finiteOrZero(raw.duration_s),
        endTime: raw.end_time,
        closeHash: String(raw.close_hash ?? ''),
      },
    };
  }
}
