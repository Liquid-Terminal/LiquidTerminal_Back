import { BaseApiService } from '../../base/base.api.service';
import { DelegatorRewards } from '../../../types/staking.types';

export class DelegatorRewardsService extends BaseApiService {
  constructor() {
    super('https://api.hyperliquid.xyz/info');
  }

  /**
   * Récupère les récompenses de staking pour une adresse donnée
   * @param address L'adresse de l'utilisateur
   */
  public async getDelegatorRewardsRaw(address: string): Promise<DelegatorRewards> {
    try {
      const response = await this.post('', {
        type: "delegatorRewards",
        user: address
      }) as DelegatorRewards;
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }
} 