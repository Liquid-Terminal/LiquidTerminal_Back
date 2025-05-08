import { PerpGlobalStats, PerpMarketData } from '../../types/market.types';
import { redisService } from '../../core/redis.service';
import { logDeduplicator } from '../../utils/logDeduplicator';

export class PerpGlobalStatsService {
  private static instance: PerpGlobalStatsService; // Ajout pour Singleton

  private readonly UPDATE_CHANNEL = 'perp:data:updated';
  private readonly MARKET_CACHE_KEY = 'perp:markets';
  private readonly VAULT_CACHE_KEY = 'vault:hlp:tvl';
  private lastUpdate: Record<string, number> = {};

  // Le constructeur devient privé
  private constructor() {
    this.setupSubscriptions();
  }

  // Méthode statique pour récupérer l'instance unique
  public static getInstance(): PerpGlobalStatsService {
    if (!PerpGlobalStatsService.instance) {
      PerpGlobalStatsService.instance = new PerpGlobalStatsService();
    }
    return PerpGlobalStatsService.instance;
  }

  private setupSubscriptions(): void {
    redisService.subscribe(this.UPDATE_CHANNEL, async (message) => {
      try {
        const { type, timestamp } = JSON.parse(message);
        if (type === 'DATA_UPDATED') {
          this.lastUpdate['markets'] = timestamp;
          logDeduplicator.info('Perp global stats cache updated', { timestamp });
        }
      } catch (error) {
        logDeduplicator.error('Error processing perp global stats cache update:', { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    });

    // S'abonner aux mises à jour de la TVL du vault
    redisService.subscribe('vault:hlp:updated', async (message) => {
      try {
        const { type, timestamp } = JSON.parse(message);
        if (type === 'DATA_UPDATED') {
          this.lastUpdate['hlpTvl'] = timestamp;
          logDeduplicator.info('HLP vault TVL cache updated', { timestamp });
        }
      } catch (error) {
        logDeduplicator.error('Error processing HLP vault TVL cache update:', { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    });
  }

  public async getPerpGlobalStats(): Promise<PerpGlobalStats> {
    try {
      // Récupérer les données des marchés perpétuels depuis le cache
      const raw = await redisService.get(this.MARKET_CACHE_KEY);
      if (!raw) {
        throw new Error('No perp market data available');
      }
      
      const marketsData = JSON.parse(raw) as PerpMarketData[];

      // Calculer le volume total sur 24h
      const totalVolume24h = marketsData.reduce((total: number, market: PerpMarketData) => total + market.volume, 0);
      
      // Calculer le nombre total de paires
      const totalPairs = marketsData.length;
      
      // Calculer l'intérêt ouvert total en dollars
      const totalOpenInterest = marketsData.reduce((total: number, market: PerpMarketData) => total + (market.openInterest * market.price), 0);

      // Récupérer la TVL du vault HLP depuis le cache
      const hlpTvlRaw = await redisService.get(this.VAULT_CACHE_KEY);
      const hlpTvl = hlpTvlRaw ? JSON.parse(hlpTvlRaw) : 0;

      logDeduplicator.info('Perp global stats retrieved successfully', { 
        totalOpenInterest,
        totalVolume24h,
        totalPairs,
        hlpTvl,
        lastUpdate: this.lastUpdate
      });

      return {
        totalOpenInterest,
        totalVolume24h,
        totalPairs,
        hlpTvl
      };
    } catch (error) {
      logDeduplicator.error('Error retrieving perp global stats:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }
} 