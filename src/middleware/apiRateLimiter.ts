import { Request, Response, NextFunction } from 'express';
import { redisService } from '../core/redis.service';
import { logDeduplicator } from '../utils/logDeduplicator';

// Configuration des limites
const RATE_LIMITS = {
  // Limites par seconde pour prévenir les bursts
  BURST_LIMIT: {
    WINDOW: 1,      // 1 seconde
    MAX_REQUESTS: 20 // 20 requêtes max par seconde pour les pics
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

// Clés Redis pour les différentes fenêtres de temps
const getRedisKeys = (ip: string) => ({
  burstKey: `ratelimit:${ip}:burst`,
  minuteKey: `ratelimit:${ip}:minute`,
  hourKey: `ratelimit:${ip}:hour`
});

export const marketRateLimiter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const ip = req.ip;
  
  if (!ip) {
    res.status(400).json({
      error: 'IP address not found',
      message: 'Could not determine client IP address'
    });
    return;
  }

  const keys = getRedisKeys(ip);
  const now = Math.floor(Date.now() / 1000);

  try {
    // Vérification multi-niveaux avec Redis
    const [burstCount, minuteCount, hourCount] = await Promise.all([
      incrementAndGetCount(keys.burstKey, now, RATE_LIMITS.BURST_LIMIT.WINDOW),
      incrementAndGetCount(keys.minuteKey, now, RATE_LIMITS.MINUTE_LIMIT.WINDOW),
      incrementAndGetCount(keys.hourKey, now, RATE_LIMITS.HOUR_LIMIT.WINDOW)
    ]);

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
    logDeduplicator.error('Rate limiter error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    // En cas d'erreur Redis, on laisse passer la requête
    return next();
  }
};

async function incrementAndGetCount(key: string, now: number, window: number): Promise<number> {
  try {
    // ✅ Utiliser directement les commandes Redis au lieu de multi()
    const redis = (redisService as any).redisNormal || (redisService as any).redis;
    
    // Ajouter le timestamp actuel au sorted set
    await redis.zadd(key, now, `${now}`);
    
    // Nettoyer les anciennes entrées
    await redis.zremrangebyscore(key, 0, now - window);
    
    // Compter les entrées restantes
    const count = await redis.zcard(key);
    
    // Définir une expiration sur la clé
    await redis.expire(key, window * 2);
    
    return count;
  } catch (error) {
    logDeduplicator.error('Rate limiter Redis error', { error });
    return 0;
  }
}

function sendLimitExceededResponse(res: Response, message: string): void {
  res.status(429).json({
    error: 'Rate limit exceeded',
    message,
    retryAfter: 60 // Suggérer d'attendre 1 minute
  });
} 