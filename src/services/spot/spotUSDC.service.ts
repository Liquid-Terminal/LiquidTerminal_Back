import { BaseApiService } from '../../core/base.api.service';
import { SpotUSDCData } from '../../types/market.types';
import { USDCDataError } from '../../errors/spot.errors';
import { logger } from '../../utils/logger';

export class SpotUSDCService extends BaseApiService {
  constructor() {
    super('https://api.hypurrscan.io');
  }

  /**
   * Récupère les données USDC spot sur Hyperliquid
   */
  public async getSpotUSDCData(): Promise<SpotUSDCData> {
    try {
      const response = await this.get('/spotUSDC') as SpotUSDCData;
      logger.info('USDC data retrieved successfully', { 
        timestamp: new Date().toISOString()
      });
      return response;
    } catch (error) {
      logger.error('Error fetching USDC data:', { error });
      throw new USDCDataError(error instanceof Error ? error.message : 'Failed to fetch USDC data');
    }
  }
} 