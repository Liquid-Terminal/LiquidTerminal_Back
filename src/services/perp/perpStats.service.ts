import { PerpGlobalStats } from '../../types/market.types';
import { PerpAssetContextService } from './perpAssetContext.service';
import { logger } from '../../utils/logger';
import { logDeduplicator } from '../../utils/logDeduplicator';

export class PerpGlobalStatsService {
  private perpAssetContextService: PerpAssetContextService;

  constructor() {
    this.perpAssetContextService = new PerpAssetContextService();
  }

  public async getPerpGlobalStats(): Promise<PerpGlobalStats> {
    try {
      // Récupérer les données des marchés perpétuels
      const perpMarketsData = await this.perpAssetContextService.getPerpMarketsData();

      // Calculer le volume total sur 24h
      const totalVolume24h = perpMarketsData.reduce((total, market) => total + market.volume, 0);
      
      // Calculer le nombre total de paires
      const totalPairs = perpMarketsData.length;
      
      // Calculer l'intérêt ouvert total
      const totalOpenInterest = perpMarketsData.reduce((total, market) => total + market.openInterest, 0);

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
      logger.error('Error fetching perp global stats:', { error });
      throw error;
    }
  }
} 