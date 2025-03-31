import { BaseApiService } from '../base/base.api.service';
import { DelegatorSummary } from '../../types/staking.types';

export class DelegatorSummaryService extends BaseApiService {
  constructor() {
    super('https://api.hyperliquid.xyz/info');
  }

  /**
   * Récupère le résumé du staking pour une adresse donnée
   * @param address L'adresse de l'utilisateur
   */
  public async getDelegatorSummaryRaw(address: string): Promise<DelegatorSummary> {
    try {
      const response = await this.post('', {
        type: "delegatorSummary",
        user: address
      }) as DelegatorSummary;
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }
} 