import { Request, Response, NextFunction } from 'express';
import { redisService } from '../core/redis.service';
import { logDeduplicator } from '../utils/logDeduplicator';

// Configuration des limites
const RATE_LIMITS = {
  // Limites par seconde pour prévenir les bursts
  BURST_LIMIT: {
    WINDOW: 1,
    // Measured in a real browser on 2026-07-26: a single page load of
    // /dashboard/market fires 15 requests inside its first second, /dashboard
    // 13. The previous value of 20 was written while the counter was broken and
    // never enforced anything; switching it on at 20 would have thrown 429s at
    // anyone with two tabs open. 60 leaves ~4x headroom over a real page while
    // still stopping a scripted flood, which runs in the hundreds per second.
    MAX_REQUESTS: 60
  },
  // Limites par minute pour le moyen terme
  MINUTE_LIMIT: {
    WINDOW: 60,       // 60 secondes
    MAX_REQUESTS: 1200 // 20 req/sec en moyenne sur la minute
  },
  // Limites par heure pour détecter les abus
  HOUR_LIMIT: {
    WINDOW: 3600,      // 3600 secondes
    MAX_REQUESTS: 72000 // 20 req/sec en moyenne sur l'heure
  }
};

interface RateWindow {
  name: string;
  seconds: number;
}

// Fenêtres de temps, dans l'ordre des compteurs renvoyés par countRequest
const MARKET_WINDOWS: readonly RateWindow[] = [
  { name: 'burst', seconds: RATE_LIMITS.BURST_LIMIT.WINDOW },
  { name: 'minute', seconds: RATE_LIMITS.MINUTE_LIMIT.WINDOW },
  { name: 'hour', seconds: RATE_LIMITS.HOUR_LIMIT.WINDOW },
];

/**
 * Counts this request in one fixed window per entry of `windows` and returns
 * the counts, in a single round trip (INCR + EXPIRE per window).
 *
 * The sorted sets this replaces kept every request as a member for the whole
 * window — up to 72k per IP for the hour — at twelve commands per request. A
 * fixed window counts a subset of what the sliding one counted, so it never
 * rejects a request the old limiter accepted; across a boundary it can admit
 * up to twice a limit, which these ceilings tolerate. (The 1 s burst window was
 * already a fixed second: members were scored in whole seconds.)
 *
 * Throws on any Redis failure so callers switch to the in-memory fallback —
 * swallowing it returned a count of 0, which let everything through.
 */
async function countRequest(prefix: string, windows: readonly RateWindow[]): Promise<number[]> {
  // Circuit open: don't queue on a wedged connection, use the fallback now.
  if (!redisService.isHealthy()) throw new Error('Redis circuit open');
  const now = Math.floor(Date.now() / 1000);
  const pipeline = redisService.getClient().pipeline();
  for (const window of windows) {
    const key = `${prefix}:${window.name}:${Math.floor(now / window.seconds)}`;
    pipeline.incr(key);
    pipeline.expire(key, window.seconds * 2);
  }

  const results = await pipeline.exec();
  if (!results) {
    throw new Error('Rate limiter pipeline aborted');
  }
  return windows.map((_, i) => {
    const [error, count] = results[i * 2];
    if (error) throw error;
    return Number(count);
  });
}

// In-memory fallback when Redis is down (fail-secure)
const inMemoryCounters = new Map<string, { count: number; resetAt: number }>();
// Was 10 — below the 15 req/s a single page load actually makes, so a Redis
// outage would have 429'd every normal user. Aligned with the burst limit.
const FALLBACK_MAX_PER_SECOND = 60;
const FALLBACK_MAX_IPS = 10000;

function checkInMemoryFallback(ip: string): boolean {
  const now = Date.now();
  const counter = inMemoryCounters.get(ip);

  if (!counter || now > counter.resetAt) {
    // Evict oldest if at capacity
    if (!inMemoryCounters.has(ip) && inMemoryCounters.size >= FALLBACK_MAX_IPS) {
      const firstKey = inMemoryCounters.keys().next().value;
      if (firstKey) inMemoryCounters.delete(firstKey);
    }
    inMemoryCounters.set(ip, { count: 1, resetAt: now + 1000 });
    return true;
  }

  if (counter.count >= FALLBACK_MAX_PER_SECOND) {
    return false;
  }

  counter.count++;
  return true;
}

// Periodic cleanup of stale entries (every 60s)
setInterval(() => {
  const now = Date.now();
  for (const [ip, counter] of inMemoryCounters) {
    if (now > counter.resetAt) {
      inMemoryCounters.delete(ip);
    }
  }
}, 60000).unref();

export const marketRateLimiter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const ip = req.ip;
  
  if (!ip) {
    res.status(400).json({
      error: 'IP address not found',
      message: 'Could not determine client IP address'
    });
    return;
  }

  try {
    // Vérification multi-niveaux avec Redis
    const [burstCount, minuteCount, hourCount] = await countRequest(`ratelimit:${ip}`, MARKET_WINDOWS);

    // Vérification des limites
    if (burstCount > RATE_LIMITS.BURST_LIMIT.MAX_REQUESTS) {
      return sendLimitExceededResponse(res, 'Too many requests per second');
    }

    if (minuteCount > RATE_LIMITS.MINUTE_LIMIT.MAX_REQUESTS) {
      return sendLimitExceededResponse(res, 'Too many requests per minute');
    }

    if (hourCount > RATE_LIMITS.HOUR_LIMIT.MAX_REQUESTS) {
      return sendLimitExceededResponse(res, 'Too many requests per hour');
    }

    next();
  } catch (error) {
    logDeduplicator.error('Rate limiter Redis error, using in-memory fallback', {
      error: error instanceof Error ? error.message : String(error),
      path: req.path,
      ip: req.ip
    });
    // Fail-secure: use in-memory fallback instead of letting everything through
    if (checkInMemoryFallback(ip)) {
      next();
    } else {
      sendLimitExceededResponse(res, 'Too many requests (fallback mode)');
    }
  }
};

function sendLimitExceededResponse(res: Response, message: string): void {
  res.status(429).json({
    error: 'Rate limit exceeded',
    message,
    retryAfter: 60 // Suggérer d'attendre 1 minute
  });
}

// Tighter limits for the /indexer/* routes a request can make reach HypeDexer
// (uncached, or cached under a key the caller picks: address, coin, limit,
// time range). Each miss is a paid upstream call and holds an outbound slot;
// the general limiter (1200/min) is far too loose to bound that cost. The
// minute cap is what bounds it: a heavy page stays under ~60 indexer requests
// in its first minute (sweep of 22 pages, 2026-09-25). The burst matches the
// general limiter's because page loads fan out: a settled HIP-4 question with
// 29 outcomes fires ~45 indexer requests in its first second, /market/hip4 18.
const PASSTHROUGH_LIMITS = {
  BURST: { WINDOW: 1, MAX_REQUESTS: 60 },
  MINUTE: { WINDOW: 60, MAX_REQUESTS: 300 },
};

interface IpLimits {
  BURST: { WINDOW: number; MAX_REQUESTS: number };
  MINUTE: { WINDOW: number; MAX_REQUESTS: number };
}

/**
 * Per-IP limiter with its own Redis namespace (so it stacks on top of the
 * general limiter instead of sharing its counters), in-memory fallback when
 * Redis cannot answer.
 */
function createIpLimiter(namespace: string, limits: IpLimits, what: string) {
  const windows: readonly RateWindow[] = [
    { name: 'burst', seconds: limits.BURST.WINDOW },
    { name: 'minute', seconds: limits.MINUTE.WINDOW },
  ];
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip;
    if (!ip) {
      res.status(400).json({ error: 'IP address not found', message: 'Could not determine client IP address' });
      return;
    }
    try {
      const [burstCount, minuteCount] = await countRequest(`ratelimit:${namespace}:${ip}`, windows);
      if (burstCount > limits.BURST.MAX_REQUESTS) {
        return sendLimitExceededResponse(res, `Too many ${what} requests per second`);
      }
      if (minuteCount > limits.MINUTE.MAX_REQUESTS) {
        return sendLimitExceededResponse(res, `Too many ${what} requests per minute`);
      }
      next();
    } catch (error) {
      logDeduplicator.error('IP rate limiter Redis error, using in-memory fallback', {
        namespace,
        error: error instanceof Error ? error.message : String(error),
        path: req.path,
        ip,
      });
      // Fail-secure, same as the general limiter. Distinct key namespace so the
      // fallbacks don't share a counter.
      if (checkInMemoryFallback(`${namespace}:${ip}`)) {
        next();
      } else {
        sendLimitExceededResponse(res, 'Too many requests (fallback mode)');
      }
    }
  };
}

export const passthroughRateLimiter = createIpLimiter('pt', PASSTHROUGH_LIMITS, 'indexer');

/**
 * Per-address lookups (Elysium address / contract profiles, per-user indexer
 * pass-through). Any valid address is a fresh cache key, so each request can
 * run a batch of SQL or a paid upstream call: a page view makes 1-4 of them,
 * 60/min per IP is ample for people and caps a scripted sweep.
 */
export const addressLookupRateLimiter = createIpLimiter(
  'addr',
  { BURST: { WINDOW: 1, MAX_REQUESTS: 8 }, MINUTE: { WINDOW: 60, MAX_REQUESTS: 60 } },
  'address lookup'
);
