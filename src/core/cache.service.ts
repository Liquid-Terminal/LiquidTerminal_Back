import { redisService } from './redis.service';
import { logDeduplicator } from '../utils/logDeduplicator';
import { CACHE_TTL } from '../constants/cache.constants';

/**
 * Service de gestion du cache
 * Encapsule la logique de cache utilisée dans les services
 */
export class CacheService {
  /**
   * Récupère une donnée du cache ou l'obtient via une fonction de récupération
   * @param key Clé de cache
   * @param fetchFn Fonction pour récupérer la donnée si elle n'est pas en cache
   * @param ttl Durée de vie du cache en secondes
   * @returns La donnée du cache ou celle récupérée par fetchFn
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = CACHE_TTL.MEDIUM
  ): Promise<T> {
    // Redis unhealthy (circuit open) → skip the cache entirely and serve from
    // source. Without this a wedged Redis connection would stall every request
    // through the get → lock → get → set path until the edge returns 502.
    if (!redisService.isHealthy()) {
      return fetchFn();
    }
    try {
      const cachedData = await redisService.get(key);
      if (cachedData) {
        return JSON.parse(cachedData);
      }

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
            return JSON.parse(freshCache);
          }

          const data = await fetchFn();
          await redisService.set(key, JSON.stringify(data), ttl);
          await redisService.delete(lockKey);
          return data;
        } catch (error) {
          await redisService.delete(lockKey);
          throw error;
        }
      }

      // Lock not acquired — wait for the lock holder to populate the cache for
      // as long as it holds the lock (up to 15s). Giving up after 600ms let a
      // burst on one slow key run the same heavy query once per request.
      for (let i = 0; i < 60; i++) {
        await new Promise(resolve => setTimeout(resolve, 250));
        const retryCache = await redisService.get(key);
        if (retryCache) {
          return JSON.parse(retryCache);
        }
        if (!(await redis.exists(lockKey))) break; // holder failed or finished without caching
      }

      // Lock holder failed (or is still running after 15s): fetch directly
      return await fetchFn();
    } catch (error) {
      logDeduplicator.warn('Cache error, falling back to direct fetch', { 
        key,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      return fetchFn();
    }
  }
  
  /**
   * Stale-while-revalidate read for slow, recomputable aggregates. The last
   * value is served at once; once it is older than `freshS`, one caller (Redis
   * lock) recomputes it in the background while everyone keeps the old value.
   * Only a cold key (never computed, or idle past `keepS`) waits for `fetchFn`.
   */
  async getOrRefresh<T>(key: string, fetchFn: () => Promise<T>, freshS: number, keepS: number): Promise<T> {
    if (!redisService.isHealthy()) return fetchFn();
    const swrKey = `${key}:swr`;
    const store = async (value: T): Promise<void> => {
      await redisService.set(swrKey, JSON.stringify({ at: Date.now(), value }), keepS);
    };
    try {
      const raw = await redisService.get(swrKey);
      if (raw) {
        const entry = JSON.parse(raw) as { at: number; value: T };
        if (Date.now() - entry.at > freshS * 1000) {
          const lockKey = `lock:${swrKey}`;
          const acquired = await redisService.getClient().set(lockKey, '1', 'EX', 120, 'NX');
          if (acquired) {
            void fetchFn()
              .then(store)
              .catch((error) => {
                logDeduplicator.warn('Background cache refresh failed', {
                  key,
                  errorType: error instanceof Error ? error.name : typeof error,
                });
              })
              .finally(() => void redisService.delete(lockKey));
          }
        }
        return entry.value;
      }
      // Cold key: compute once behind the regular stampede lock, then keep it warm.
      return await this.getOrSet(`${key}:cold`, async () => {
        const value = await fetchFn();
        await store(value);
        return value;
      }, freshS);
    } catch (error) {
      logDeduplicator.warn('Cache error, falling back to direct fetch', {
        key,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      return fetchFn();
    }
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