import { BaseApiService } from '../base/base.api.service';
import type { WalletState, WalletHolding } from '../../types/wallet.types';

export class SpotBalanceApiService extends BaseApiService {
  constructor() {
    super('https://api.hyperliquid.xyz/info');
  }

  // Retourne les données brutes de l'API
  async getSpotClearinghouseStateRaw(address: string): Promise<any> {
    return this.post('', {
      type: "spotClearinghouseState",
      user: address
    });
  }

  // Retourne les données formatées pour notre application
  async getWalletState(address: string): Promise<WalletState> {
    try {
      const data = await this.getSpotClearinghouseStateRaw(address);
      const holdings = data.balances || [];
      
      return {
        address,
        holdings: holdings.filter((holding: WalletHolding) => 
          Number(holding.total) > 0
        )
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }
}