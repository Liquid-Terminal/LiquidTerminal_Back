import { BaseApiService } from '../base/base.api.service';
import type { PerpAccountState } from '../../types/wallet.types';

export class PerpBalanceApiService extends BaseApiService {
  constructor() {
    super('https://api.hyperliquid.xyz/info');
  }

  // Retourne les données brutes de l'API
  async getPerpAccountStateRaw(address: string): Promise<any> {
    return this.post('', {
      type: "clearinghouseState",
      user: address
    });
  }

  // Retourne les données formatées pour notre application
  async getPerpAccountState(address: string): Promise<PerpAccountState> {
    try {
      const data = await this.getPerpAccountStateRaw(address);
      
      return {
        assetPositions: data.assetPositions || [],
        crossMaintenanceMarginUsed: data.crossMaintenanceMarginUsed || '0',
        crossMarginSummary: data.crossMarginSummary || {
          accountValue: '0',
          totalMarginUsed: '0',
          totalNtlPos: '0',
          totalRawUsd: '0'
        },
        marginSummary: data.marginSummary || {
          accountValue: '0',
          totalMarginUsed: '0',
          totalNtlPos: '0',
          totalRawUsd: '0'
        },
        time: data.time || Date.now(),
        withdrawable: data.withdrawable || '0'
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }
} 