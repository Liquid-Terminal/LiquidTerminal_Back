import { SpotGlobalStats, MarketData } from '../../types/market.types';
import { SpotAssetContextService } from './marketData.service';
import { logger } from '../../utils/logger';
import { logDeduplicator } from '../../utils/logDeduplicator';
import { redisService } from '../../core/redis.service';

export class SpotGlobalStatsService {
  private spotAssetContextService: SpotAssetContextService;
  private static readonly SPOT_USDC_CACHE_KEY = 'hypurrscan:spotUSDC:data';
  private static readonly SPOT_USDC_UPDATE_CHANNEL = 'hypurrscan:spotUSDC:updated';
  private lastSpotUSDCUpdate: number = 0;

  constructor() {
    this.spotAssetContextService = new SpotAssetContextService();
    this.setupSpotUSDCSubscriptions();
  }

  private setupSpotUSDCSubscriptions(): void {
    redisService.subscribe(SpotGlobalStatsService.SPOT_USDC_UPDATE_CHANNEL, async (message) => {
      try {
        const { type, timestamp } = JSON.parse(message);
        if (type === 'DATA_UPDATED') {
          this.lastSpotUSDCUpdate = timestamp;
          logDeduplicator.info('SpotUSDC data cache updated', { timestamp });
        }
      } catch (error) {
        logger.error('Error processing SpotUSDC cache update:', { error });
      }
    });
  }

  public async getSpotGlobalStats(): Promise<SpotGlobalStats> {
    try {
      // Récupérer les données en parallèle
      const [marketsData, spotUSDCData] = await Promise.all([
        this.spotAssetContextService.getMarketsData({ limit: 1000 }), // Récupérer toutes les données
        this.getSpotUSDCDataFromCache()
      ]);

      // Calculer le volume total sur 24h
      const totalVolume24h = marketsData.data.reduce((total: number, market: MarketData) => total + market.volume, 0);
      
      // Calculer le nombre total de paires
      const totalPairs = marketsData.data.length;
      
      // Calculer la capitalisation totale du marché
      const totalMarketCap = marketsData.data.reduce((total: number, market: MarketData) => total + market.marketCap, 0);
      
      // Récupérer les données USDC spot les plus récentes
      const latestSpotUSDCData = spotUSDCData && spotUSDCData.length > 0 
        ? spotUSDCData[spotUSDCData.length - 1]
        : null;

      const totalSpotUSDC = latestSpotUSDCData?.totalSpotUSDC || 0;
      const totalHIP2 = latestSpotUSDCData?.['HIP-2'] || 0;

      logDeduplicator.info('Spot global stats retrieved successfully', { 
        totalVolume24h,
        totalPairs,
        totalMarketCap,
        totalSpotUSDC,
        totalHIP2
      });

      return {
        totalVolume24h,
        totalPairs,
        totalMarketCap,
        totalSpotUSDC,
        totalHIP2
      };
    } catch (error) {
      logger.error('Error retrieving spot global stats:', error);
      throw error;
    }
  }

  private async getSpotUSDCDataFromCache() {
    try {
      const cachedData = await redisService.get(SpotGlobalStatsService.SPOT_USDC_CACHE_KEY);
      return cachedData ? JSON.parse(cachedData) : null;
    } catch (error) {
      logger.error('Error retrieving SpotUSDC data from cache:', { error });
      return null;
    }
  }
} 