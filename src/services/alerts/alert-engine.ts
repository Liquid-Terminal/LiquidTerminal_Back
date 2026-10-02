import { logDeduplicator } from '../../utils/logDeduplicator';
import { redisService } from '../../core/redis.service';
import { RecentEventCache } from '../../utils/telegram.alert-dedup';

/**
 * Generic alert engine shared by every Telegram alert type.
 *
 * One pipeline = one alert type (fills, liquidations, closed trades, ...). It
 * supplies its rules, how to read an event, and how to deliver a match; the
 * engine does the rest, identically for every type:
 *
 * - Rules are loaded on a background timer and compiled into an index by
 *   wallet and by coin, so an event only meets the rules that can match it
 *   (O(candidates), not O(all subscriptions)). The hot path never waits on
 *   the database.
 * - Dedup claims the (scope, event) keys in one Redis pipeline (SET NX EX), with
 *   an in-memory cache in front. If Redis is down it falls back to memory and
 *   fails open, as before. No database write per alert any more.
 * - A per-user budget caps how many alerts one Telegram user receives per
 *   minute, so one noisy rule cannot eat the bot's global send budget; the
 *   overflow is reported once per window instead of dropped silently.
 * - Event batches go through a bounded serial queue: a burst can't grow
 *   memory without limit, it drops the oldest batches and counts them.
 * - Counters per pipeline are logged every 5 minutes.
 *
 * Adding an alert type means writing a pipeline, not another dispatcher.
 */

/** A compiled subscription. `wallets`/`coins` empty = no constraint on that axis. */
export interface AlertRule<E> {
  id: string;
  /** Telegram chat to deliver to (BigInt as string). */
  telegramId: string;
  /** Lowercase addresses the event must involve. Empty = any wallet. */
  wallets: string[];
  /** Uppercase coins the event must be on. Empty = any coin. */
  coins: string[];
  /** Remaining filters (size, side, direction, ...), run on candidates only. */
  matches: (event: E) => boolean;
  /** Dedup scope: one alert per (scope, event). A rule id, or a user id for per-user dedup. */
  dedupScope: string;
}

export interface EventKeys {
  /** Stable event id (hash, trade id, order id...). */
  id: string;
  /** Lowercase addresses involved in the event. */
  wallets: string[];
  coin: string;
}

export interface AlertPipeline<E, R extends AlertRule<E> = AlertRule<E>> {
  /** Short name, used in dedup keys, logs and counters. */
  name: string;
  loadRules: () => Promise<R[]>;
  keys: (event: E) => EventKeys;
  deliver: (rule: R, event: E) => void;
  /** Sends a plain notice to a user (used for the throttling notice). */
  notify: (telegramId: string, message: string) => void;
}

export interface AlertEngineOptions {
  /** How often rules are reloaded. */
  refreshMs?: number;
  /** Per-user budget. Defaults to the process-wide shared limiter. */
  limiter?: DeliveryLimiter;
  /** Event batches waiting before the oldest are dropped. */
  maxPendingBatches?: number;
  /** Dedup key lifetime. */
  dedupTtlSeconds?: number;
}

/** Index of rules by wallet and by coin. Built once per refresh, read on every event. */
export class RuleIndex<E, R extends AlertRule<E> = AlertRule<E>> {
  private readonly byWallet = new Map<string, R[]>();
  private readonly byCoin = new Map<string, R[]>();
  private readonly wildcard: R[] = [];
  readonly size: number;

  constructor(rules: R[]) {
    this.size = rules.length;
    for (const rule of rules) {
      if (rule.wallets.length > 0) {
        for (const w of new Set(rule.wallets)) push(this.byWallet, w, rule);
      } else if (rule.coins.length > 0) {
        for (const c of new Set(rule.coins)) push(this.byCoin, c, rule);
      } else {
        this.wildcard.push(rule);
      }
    }
  }

  /**
   * Rules whose wallet and coin constraints the event satisfies. Wallet rules
   * are reached through the wallet map and then checked on coin; coin-only
   * rules through the coin map; unconstrained rules always.
   */
  candidates(keys: EventKeys): R[] {
    const coin = keys.coin.toUpperCase();
    const out: R[] = [];
    const seen = new Set<string>();
    for (const w of keys.wallets) {
      for (const rule of this.byWallet.get(w) ?? []) {
        if (seen.has(rule.id)) continue;
        if (rule.coins.length > 0 && !rule.coins.includes(coin)) continue;
        seen.add(rule.id);
        out.push(rule);
      }
    }
    for (const rule of this.byCoin.get(coin) ?? []) out.push(rule);
    for (const rule of this.wildcard) out.push(rule);
    return out;
  }
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/** Sliding per-user budget; reports what it held back once per window. */
export class DeliveryLimiter {
  private readonly windows = new Map<string, { start: number; sent: number; held: number }>();

  constructor(
    readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now
  ) {}

  /** True if the user may receive one more alert now. */
  allow(user: string): boolean {
    const t = this.now();
    let w = this.windows.get(user);
    if (!w || t - w.start >= this.windowMs) {
      w = { start: t, sent: 0, held: 0 };
      this.windows.set(user, w);
    }
    if (w.sent < this.limit) {
      w.sent += 1;
      return true;
    }
    w.held += 1;
    return false;
  }

  /** Users whose window has closed with alerts held back; resets them. */
  drainHeld(): { user: string; held: number }[] {
    const t = this.now();
    const out: { user: string; held: number }[] = [];
    for (const [user, w] of this.windows) {
      if (t - w.start < this.windowMs) continue;
      if (w.held > 0) out.push({ user, held: w.held });
      this.windows.delete(user);
    }
    return out;
  }
}

/** Serial queue with a cap on waiting batches: drops the oldest instead of growing. */
export class BoundedSerialQueue<T> {
  private readonly pending: T[] = [];
  private running = false;
  dropped = 0;

  constructor(
    private readonly max: number,
    private readonly worker: (item: T) => Promise<void>,
    private readonly context: string
  ) {}

  push(item: T): void {
    this.pending.push(item);
    if (this.pending.length > this.max) {
      this.pending.shift();
      this.dropped += 1;
    }
    if (!this.running) void this.drain();
  }

  get depth(): number {
    return this.pending.length;
  }

  private async drain(): Promise<void> {
    this.running = true;
    while (this.pending.length) {
      const item = this.pending.shift() as T;
      try {
        await this.worker(item);
      } catch (error) {
        logDeduplicator.error(`${this.context}: batch failed`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    this.running = false;
  }
}

/**
 * One budget per Telegram user across every alert type: the cap protects the
 * bot's global send rate, so fills and liquidations share it.
 */
export const DEFAULT_PER_USER_LIMIT = 30;
export const DEFAULT_PER_USER_WINDOW_MS = 60_000;
export const sharedDeliveryLimiter = new DeliveryLimiter(DEFAULT_PER_USER_LIMIT, DEFAULT_PER_USER_WINDOW_MS);

interface Counters {
  events: number;
  candidates: number;
  matched: number;
  duplicates: number;
  throttled: number;
  sent: number;
}

const zero = (): Counters => ({ events: 0, candidates: 0, matched: 0, duplicates: 0, throttled: 0, sent: 0 });

export class AlertEngine<E, R extends AlertRule<E> = AlertRule<E>> {
  private index: RuleIndex<E, R> = new RuleIndex<E, R>([]);
  private readonly recent = new RecentEventCache();
  private readonly limiter: DeliveryLimiter;
  private readonly queue: BoundedSerialQueue<E[]>;
  private counters = zero();
  private timers: NodeJS.Timeout[] = [];
  private loaded = false;
  private refreshing: Promise<void> | null = null;
  private readonly opts: Required<AlertEngineOptions>;

  constructor(private readonly pipeline: AlertPipeline<E, R>, options: AlertEngineOptions = {}) {
    this.opts = {
      refreshMs: 30_000,
      limiter: sharedDeliveryLimiter,
      maxPendingBatches: 500,
      dedupTtlSeconds: 24 * 60 * 60,
      ...options,
    };
    this.limiter = this.opts.limiter;
    this.queue = new BoundedSerialQueue(this.opts.maxPendingBatches, (batch) => this.process(batch), `AlertEngine:${pipeline.name}`);
  }

  start(): void {
    void this.refresh();
    this.timers.push(setInterval(() => void this.refresh(), this.opts.refreshMs));
    this.timers.push(setInterval(() => this.flushHeldNotices(), 15_000));
    this.timers.push(setInterval(() => this.logCounters(), 5 * 60_000));
    for (const t of this.timers) t.unref?.();
  }

  stop(): void {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    this.index = new RuleIndex<E, R>([]);
    this.loaded = false;
    this.recent.clear();
  }

  /** Queue a batch of events. Never blocks the caller. */
  ingest(events: E[]): void {
    if (events.length) this.queue.push(events);
  }

  /** Current number of compiled rules (for health checks and tests). */
  get ruleCount(): number {
    return this.index.size;
  }

  /** Reload and recompile the rules. Keeps the previous index on failure. */
  refresh(): Promise<void> {
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      try {
        this.index = new RuleIndex<E, R>(await this.pipeline.loadRules());
        this.loaded = true;
      } catch (error) {
        logDeduplicator.error(`AlertEngine:${this.pipeline.name}: rule refresh failed, keeping previous rules`, {
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  /** Exposed for tests: run one batch through matching, dedup, budget and delivery. */
  async process(events: E[]): Promise<void> {
    if (!this.loaded) await this.refresh();
    const index = this.index;
    if (index.size === 0) return;

    for (const event of events) {
      this.counters.events += 1;
      const keys = this.pipeline.keys(event);
      const candidates = index.candidates(keys);
      if (!candidates.length) continue;
      this.counters.candidates += candidates.length;

      const matched: R[] = [];
      for (const rule of candidates) {
        if (rule.matches(event)) matched.push(rule);
      }
      if (!matched.length) continue;
      this.counters.matched += matched.length;

      // Memory first, then one Redis round trip for the rest.
      const fresh: { rule: R; key: string }[] = [];
      for (const rule of matched) {
        const key = `alert:${this.pipeline.name}:${rule.dedupScope}:${keys.id}`;
        if (this.recent.has(key)) {
          this.counters.duplicates += 1;
          continue;
        }
        this.recent.add(key);
        fresh.push({ rule, key });
      }
      if (!fresh.length) continue;
      // null = Redis unavailable: memory dedup only, fail open.
      const claimed = await redisService.claimKeys(fresh.map((f) => f.key), this.opts.dedupTtlSeconds);

      fresh.forEach(({ rule }, i) => {
        if (claimed && !claimed[i]) {
          this.counters.duplicates += 1;
          return;
        }
        if (!this.limiter.allow(rule.telegramId)) {
          this.counters.throttled += 1;
          return;
        }
        try {
          this.pipeline.deliver(rule, event);
          this.counters.sent += 1;
        } catch (error) {
          logDeduplicator.error(`AlertEngine:${this.pipeline.name}: delivery failed`, {
            ruleId: rule.id,
            eventId: keys.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    }
  }

  private flushHeldNotices(): void {
    for (const { user, held } of this.limiter.drainHeld()) {
      try {
        this.pipeline.notify(
          user,
          `⏸ <b>${held} alert${held > 1 ? 's' : ''} held back</b> in the last minute: ` +
            `alerts are capped at ${this.limiter.limit} per minute. Raise the minimum size or narrow the coins to see fewer, bigger moves.`
        );
      } catch {
        // Best effort.
      }
    }
  }

  private logCounters(): void {
    const c = this.counters;
    this.counters = zero();
    if (!c.events && !this.queue.dropped) return;
    logDeduplicator.info(`AlertEngine:${this.pipeline.name}: 5 min summary`, {
      rules: this.index.size,
      ...c,
      queueDepth: this.queue.depth,
      droppedBatches: this.queue.dropped,
    });
    this.queue.dropped = 0;
  }
}
