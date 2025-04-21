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
    try {
      // Essayer de récupérer la donnée du cache
      const cachedData = await redisService.get(key);
      if (cachedData) {
        logDeduplicator.info('Data retrieved from cache', { key });
        return JSON.parse(cachedData);
      }
      
      // Si pas en cache, récupérer la donnée et la mettre en cache
      const data = await fetchFn();
      await redisService.set(key, JSON.stringify(data), ttl);
      logDeduplicator.info('Data cached successfully', { key });
      
      return data;
    } catch (error) {
      // En cas d'erreur de cache, récupérer la donnée directement
      logDeduplicator.warn('Cache error, falling back to database', { 
        error, 
        key,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
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
      const keys = await redisService.keys(pattern);
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