import { redisService } from '../../core/redis.service';
import { logDeduplicator } from '../../utils/logDeduplicator';
import { HyperfolioQuotaExhaustedError } from '../../errors/hyperfolio.errors';

/**
 * Global daily ceiling on calls sent to Hyperfolio with our key.
 *
 * The per-IP and per-second budgets bound one caller and the burst rate, but
 * not the total: callers rotating IPs can keep the per-second budget full all
 * day and burn the key's quota (or turn us into a free Hyperfolio proxy). This
 * counter is shared across instances through Redis and hard-stops upstream
 * calls once the day's budget is spent; cached responses keep being served.
 */
const DEFAULT_DAILY_BUDGET = 50_000;
const WARN_RATIO = 0.8;
const KEY_PREFIX = 'hyperfolio:upstream-calls:';
/** Keep yesterday's counter around for inspection, then let Redis drop it. */
const KEY_TTL_SECONDS = 2 * 24 * 60 * 60;

function resolveDailyBudget(): number {
  const raw = Number.parseInt(process.env.HYPERFOLIO_DAILY_BUDGET ?? '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DAILY_BUDGET;
}

export const HYPERFOLIO_DAILY_BUDGET = resolveDailyBudget();

function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/**
 * Local fallback when Redis is unreachable: the budget then applies per
 * process, which is looser but never blocks traffic on a Redis outage.
 */
let localDay = '';
let localCount = 0;
let warnedDay = '';

function countLocally(day: string): number {
  if (day !== localDay) {
    localDay = day;
    localCount = 0;
  }
  localCount += 1;
  return localCount;
}

async function countInRedis(day: string): Promise<number> {
  const key = `${KEY_PREFIX}${day}`;
  const [[incrErr, count], [expireErr]] = (await redisService
    .multi()
    .incr(key)
    .expire(key, KEY_TTL_SECONDS)
    .exec()) as [[Error | null, number], [Error | null, unknown]];
  if (incrErr) throw incrErr;
  if (expireErr) throw expireErr;
  return count;
}

/**
 * Record one upstream call and refuse it once today's budget is spent.
 * Call right before each outbound request (retries included).
 */
export async function consumeHyperfolioDailyBudget(now: number = Date.now()): Promise<void> {
  const day = utcDay(now);
  let count: number;
  try {
    count = await countInRedis(day);
  } catch (error) {
    logDeduplicator.warn('Hyperfolio daily budget: Redis unavailable, counting per process', {
      error: error instanceof Error ? error.message : String(error),
    });
    count = countLocally(day);
  }

  if (count > HYPERFOLIO_DAILY_BUDGET) {
    logDeduplicator.error('Hyperfolio daily budget exhausted, upstream calls refused until 00:00 UTC', {
      day,
      budget: HYPERFOLIO_DAILY_BUDGET,
    });
    throw new HyperfolioQuotaExhaustedError();
  }
  if (count >= HYPERFOLIO_DAILY_BUDGET * WARN_RATIO && warnedDay !== day) {
    warnedDay = day;
    logDeduplicator.warn('Hyperfolio daily budget above 80%', {
      day,
      count,
      budget: HYPERFOLIO_DAILY_BUDGET,
    });
  }
}

/** Test hook: forget the local fallback counter. */
export function resetHyperfolioQuotaForTests(): void {
  localDay = '';
  localCount = 0;
  warnedDay = '';
}
