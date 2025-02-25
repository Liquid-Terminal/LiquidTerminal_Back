import { BaseApiService } from '../../base/base.api.service';
import { DelegatorHistory } from '../../../types/staking.types';

export class DelegatorHistoryService extends BaseApiService {
  constructor() {
    super('https://api.hyperliquid.xyz/info');
  }

  /**
   * Récupère l'historique du staking pour une adresse donnée
   * @param address L'adresse de l'utilisateur
   */
  public async getDelegatorHistoryRaw(address: string): Promise<DelegatorHistory> {
    try {
      const response = await this.post('', {
        type: "delegatorHistory",
        user: address
      }) as DelegatorHistory;
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }
} 