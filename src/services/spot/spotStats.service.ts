import { SpotGlobalStats, MarketData } from '../../types/market.types';
import { redisService } from '../../core/redis.service';
import { logDeduplicator } from '../../utils/logDeduplicator';

export class SpotGlobalStatsService {
  private readonly SPOT_MARKETS_CACHE_KEY = 'spot:markets';
  private readonly SPOT_USDC_CACHE_KEY = 'spotUSDC:raw_data';
  private readonly SPOT_MARKETS_UPDATE_CHANNEL = 'spot:data:updated';
  private readonly SPOT_USDC_UPDATE_CHANNEL = 'hypurrscan:spotUSDC:updated';
  private lastUpdate: Record<string, number> = {};

  constructor() {
    this.setupSubscriptions();
  }

  private setupSubscriptions(): void {
    // S'abonner aux mises à jour des données de marché
    redisService.subscribe(this.SPOT_MARKETS_UPDATE_CHANNEL, async (message) => {
      try {
        const { type, timestamp } = JSON.parse(message);
        if (type === 'DATA_UPDATED') {
          this.lastUpdate['markets'] = timestamp;
          logDeduplicator.info('Spot markets data cache updated', { timestamp });
        }
      } catch (error) {
        logDeduplicator.error('Error processing spot markets cache update:', { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    });

    // S'abonner aux mises à jour des données USDC
    redisService.subscribe(this.SPOT_USDC_UPDATE_CHANNEL, async (message) => {
      try {
        const { type, dataType, timestamp } = JSON.parse(message);
        if (type === 'DATA_UPDATED') {
          this.lastUpdate[dataType] = timestamp;
          logDeduplicator.info('Spot USDC data cache updated', { 
            dataType, 
            timestamp 
          });
        }
      } catch (error) {
        logDeduplicator.error('Error processing spot USDC cache update:', { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    });
  }

  public async getSpotGlobalStats(): Promise<SpotGlobalStats> {
    try {
      // Récupérer les données en parallèle
      const [marketsData, spotUSDCData] = await Promise.all([
        this.getMarketsDataFromCache(),
        this.getSpotUSDCDataFromCache()
      ]);

      if (!marketsData) {
        throw new Error('No spot market data available');
      }

      // Calculer le volume total sur 24h
      const totalVolume24h = marketsData.reduce((total: number, market: MarketData) => total + market.volume, 0);
      
      // Calculer le nombre total de paires
      const totalPairs = marketsData.length;
      
      // Calculer la capitalisation totale du marché
      const totalMarketCap = marketsData.reduce((total: number, market: MarketData) => total + market.marketCap, 0);
      
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
        totalHIP2,
        lastUpdate: this.lastUpdate
      });

      return {
        totalVolume24h,
        totalPairs,
        totalMarketCap,
        totalSpotUSDC,
        totalHIP2
      };
    } catch (error) {
      logDeduplicator.error('Error retrieving spot global stats:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  private async getMarketsDataFromCache(): Promise<MarketData[] | null> {
    try {
      const raw = await redisService.get(this.SPOT_MARKETS_CACHE_KEY);
      return raw ? JSON.parse(raw) as MarketData[] : null;
    } catch (error) {
      logDeduplicator.error('Error retrieving market data from cache:', { error });
      return null;
    }
  }

  private async getSpotUSDCDataFromCache() {
    try {
      const cachedData = await redisService.get(this.SPOT_USDC_CACHE_KEY);
      return cachedData ? JSON.parse(cachedData) : null;
    } catch (error) {
      logDeduplicator.error('Error retrieving SpotUSDC data from cache:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return null;
    }
  }
} 