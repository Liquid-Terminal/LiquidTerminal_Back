import { GlobalStats, GlobalStatsResponse } from '../../types/globalStats.types';
import { redisService } from '../redis.service';

export class GlobalStatsService {
  private readonly HYPERLIQUID_API = 'https://api.hyperliquid.xyz/info';
  private readonly CACHE_KEY = 'global_stats';
  private readonly CACHE_DURATION = 60 * 5; // 5 minutes

  public async getGlobalStats(): Promise<GlobalStats> {
    try {
      // Vérifier le cache d'abord
      const cachedData = await redisService.get(this.CACHE_KEY);
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      // Si pas de cache, faire l'appel API
      const response = await fetch(this.HYPERLIQUID_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: "globalStats" })
      });

      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }

      const data = await response.json() as GlobalStatsResponse;

      // Mettre en cache
      await redisService.set(
        this.CACHE_KEY,
        JSON.stringify(data),
        this.CACHE_DURATION
      );

      return data;
    } catch (error) {
      console.error('Error fetching global stats:', error);
      throw error;
    }
  }
} 