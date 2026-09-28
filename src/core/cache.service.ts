import { redisService } from './redis.service';
import { logDeduplicator } from '../utils/logDeduplicator';
import { CACHE_TTL } from '../constants/cache.constants';

/** What a recomputation produced, and the JSON it stored when it could. */
interface Recomputed<T> {
  data: T;
  serialized?: string;
}

/**
 * Seconds to keep an entry: a constant, or a function of the value fetched
 * (e.g. keep an empty upstream answer longer than a busy one).
 */
export type CacheTtl<T> = number | ((data: T) => number);

/**
 * Whole seconds, at least 1: a 0 TTL would store the key without expiry. A
 * throwing TTL function falls back to the default rather than failing a fetch
 * that already succeeded (and paid for its upstream call).
 */
function resolveTtl<T>(ttl: CacheTtl<T>, data: T): number {
  let seconds: number;
  try {
    seconds = typeof ttl === 'function' ? ttl(data) : ttl;
  } catch {
    return CACHE_TTL.MEDIUM;
  }
  return Number.isFinite(seconds) ? Math.max(1, Math.ceil(seconds)) : CACHE_TTL.MEDIUM;
}

/**
 * Service de gestion du cache
 * Encapsule la logique de cache utilisée dans les services
 */
export class CacheService {
  /**
   * Misses being recomputed by this process, by key. The Redis lock below
   * only made concurrent misses poll for 600 ms and then call fetchFn
   * themselves, so a slow fetchFn still ran once per waiting request.
   */
  private readonly recomputing = new Map<string, Promise<Recomputed<unknown>>>();

  /**
   * Récupère une donnée du cache ou l'obtient via une fonction de récupération
   * @param key Clé de cache
   * @param fetchFn Fonction pour récupérer la donnée si elle n'est pas en cache
   * @param ttl Durée de vie du cache en secondes, ou fonction de la donnée récupérée
   * @returns La donnée du cache ou celle récupérée par fetchFn
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: CacheTtl<T> = CACHE_TTL.MEDIUM
  ): Promise<T> {
    try {
      const cachedData = await redisService.get(key);
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      // Already being recomputed here: share it. Like the lock waiters, get a
      // copy of what was stored rather than the object handed to the first caller.
      const inflight = this.recomputing.get(key) as Promise<Recomputed<T>> | undefined;
      if (inflight) {
        const { serialized } = await inflight;
        return serialized !== undefined ? JSON.parse(serialized) : await fetchFn();
      }

      const recomputation = this.recompute(key, fetchFn, ttl);
      this.recomputing.set(key, recomputation);
      try {
        return (await recomputation).data;
      } finally {
        if (this.recomputing.get(key) === recomputation) {
          this.recomputing.delete(key);
        }
      }
    } catch (error) {
      logDeduplicator.warn('Cache error, falling back to direct fetch', { 
        key,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      return fetchFn();
    }
  }

  /** Cache miss path, coordinated across instances by a Redis lock. */
  private async recompute<T>(key: string, fetchFn: () => Promise<T>, ttl: CacheTtl<T>): Promise<Recomputed<T>> {
    // Try to acquire lock to prevent cache stampede
    const lockKey = `lock:${key}`;
    const redis = redisService.getClient();
    const acquired = await redis.set(lockKey, '1', 'EX', 30, 'NX');

    if (acquired) {
      try {
        // Double-check cache (another request may have populated it)
        const freshCache = await redisService.get(key);
        if (freshCache) {
          await redisService.delete(lockKey);
          return { data: JSON.parse(freshCache), serialized: freshCache };
        }

        const data = await fetchFn();
        const serialized = JSON.stringify(data);
        await redisService.set(key, serialized, resolveTtl(ttl, data));
        await redisService.delete(lockKey);
        return { data, serialized };
      } catch (error) {
        await redisService.delete(lockKey);
        throw error;
      }
    }

    // Lock not acquired — wait for the lock holder to populate cache
    for (let i = 0; i < 3; i++) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const retryCache = await redisService.get(key);
      if (retryCache) {
        return { data: JSON.parse(retryCache), serialized: retryCache };
      }
    }

    // Lock holder may have failed, fetch directly
    const data = await fetchFn();
    let serialized: string | undefined;
    try {
      serialized = JSON.stringify(data);
    } catch {
      serialized = undefined;
    }
    return { data, serialized };
  }
  
  /**
   * Invalide une clé de cache
   * @param key Clé de cache à invalider
   */
  async invalidate(key: string): Promise<void> {
    try {
      await redisService.delete(key);
      logDeduplicator.info('Cache invalidated', { key });
    } catch (error) {
      logDeduplicator.error('Error invalidating cache:', { 
        error, 
        key,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  /**
   * Invalide toutes les clés de cache correspondant à un pattern
   * @param pattern Pattern des clés à invalider
   */
  async invalidateByPattern(pattern: string): Promise<void> {
    try {
      const keys = await redisService.scan(pattern);
      if (keys && keys.length > 0) {
        await Promise.all(keys.map(key => redisService.delete(key)));
        logDeduplicator.info('Cache invalidated by pattern', { 
          pattern, 
          count: keys.length 
        });
      }
    } catch (error) {
      logDeduplicator.error('Error invalidating cache by pattern:', { 
        error, 
        pattern,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

// Instance singleton du service de cache
export const cacheService = new CacheService(); 