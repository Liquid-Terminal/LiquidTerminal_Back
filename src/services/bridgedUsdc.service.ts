import { BaseApiService } from './base/base.api.service';
import { BridgedUsdcData } from '../types/market.types';

export class BridgedUsdcService extends BaseApiService {
  constructor() {
    super('https://stablecoins.llama.fi');
  }

  /**
   * Récupère les données USDC bridgées sur Hyperliquid
   */
  public async getBridgedUsdcData(): Promise<BridgedUsdcData[]> {
    try {
      const response = await this.get('/stablecoincharts/Hyperliquid?stablecoin=2') as BridgedUsdcData[];
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }
} 