import { BaseApiService } from '../../base/base.api.service';
import { SpotContext } from '../../../types/market.types';

export class SpotMetaService extends BaseApiService {
  constructor() {
    super('https://api.hyperliquid.xyz/info');
  }

  /**
   * Récupère les métadonnées spot brutes de l'API Hyperliquid
   */
  public async getSpotMetaRaw(): Promise<SpotContext> {
    try {
      const response = await this.post('', {
        type: "spotMeta"
      }) as SpotContext;
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }
} 