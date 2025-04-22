import { PerpGlobalStats, PerpMarketData } from '../../types/market.types';
import { PerpAssetContextService } from './perpAssetContext.service';
import { logDeduplicator } from '../../utils/logDeduplicator';

export class PerpGlobalStatsService {
  private perpAssetContextService: PerpAssetContextService;

  constructor() {
    this.perpAssetContextService = new PerpAssetContextService();
  }

  public async getPerpGlobalStats(): Promise<PerpGlobalStats> {
    try {
      // Récupérer les données des marchés perpétuels
      const perpMarketsData = await this.perpAssetContextService.getPerpMarketsData({ limit: 1000 });

      // Calculer le volume total sur 24h
      const totalVolume24h = perpMarketsData.data.reduce((total: number, market: PerpMarketData) => total + market.volume, 0);
      
      // Calculer le nombre total de paires
      const totalPairs = perpMarketsData.data.length;
      
      // Calculer l'intérêt ouvert total
      const totalOpenInterest = perpMarketsData.data.reduce((total: number, market: PerpMarketData) => total + market.openInterest, 0);

      logDeduplicator.info('Perp global stats retrieved successfully', { 
        totalOpenInterest,
        totalVolume24h,
        totalPairs
      });

      return {
        totalOpenInterest,
        totalVolume24h,
        totalPairs
      };
    } catch (error) {
      logDeduplicator.error('Error retrieving perp global stats:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }
} 