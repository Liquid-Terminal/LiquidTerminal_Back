import { BaseApiService } from '../../base/base.api.service';
import { SpotUSDCData } from '../../../types/spotUSDC.types';

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
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }
} 