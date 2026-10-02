import { logDeduplicator } from './logDeduplicator';

/**
 * Helpers shared by the Telegram alert dispatchers. Matching, dedup and
 * back-pressure live in the AlertEngine (services/alerts/alert-engine.ts);
 * what remains here is the in-memory dedup cache it uses and the purge of
 * the legacy *_sent_alerts tables.
 */

/**
 * Bounded in-memory set of recently-seen dedup keys with FIFO eviction.
 * Absorbs repeated events (WS re-flush / reconnect) so the database is hit at
 * most once per key — the primary guard against connection-pool exhaustion.
 */
export class RecentEventCache {
  private readonly keys = new Set<string>();
  private readonly order: string[] = [];

  constructor(private readonly maxSize: number = 50_000) {}

  has(key: string): boolean {
    return this.keys.has(key);
  }

  add(key: string): void {
    if (this.keys.has(key)) return;
    this.keys.add(key);
    this.order.push(key);
    if (this.order.length > this.maxSize) {
      const evicted = this.order.shift();
      if (evicted !== undefined) this.keys.delete(evicted);
    }
  }

  clear(): void {
    this.keys.clear();
    this.order.length = 0;
  }
}

/** Rows older than this are deleted by the periodic purge. */
const SENT_ALERT_RETENTION_MS = 24 * 60 * 60 * 1000;
/** How often the purge runs. */
const PURGE_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Start an hourly job that deletes sent-alert rows older than 24h, keeping the
 * dedup table from growing unbounded. `purge` receives the cutoff Date and
 * should run a `deleteMany`. Returns the timer — clear it on dispatcher stop.
 */
export function startSentAlertPurge(
  purge: (cutoff: Date) => Promise<{ count: number }>,
  context: string
): NodeJS.Timeout {
  const run = async (): Promise<void> => {
    try {
      const { count } = await purge(new Date(Date.now() - SENT_ALERT_RETENTION_MS));
      if (count > 0) {
        logDeduplicator.info(`${context}: purged ${count} stale sent-alert rows`);
      }
    } catch (error) {
      logDeduplicator.warn(`${context}: sent-alert purge failed`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const timer = setInterval(run, PURGE_INTERVAL_MS);
  timer.unref?.();
  return timer;
}
