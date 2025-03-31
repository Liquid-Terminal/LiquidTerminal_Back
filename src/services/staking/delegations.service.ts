import { BaseApiService } from '../base/base.api.service';
import { Delegation } from '../../types/staking.types';

export class DelegationsService extends BaseApiService {
  constructor() {
    super('https://api.hyperliquid.xyz/info');
  }

  /**
   * Récupère les délégations de staking pour une adresse donnée
   * @param address L'adresse de l'utilisateur
   */
  public async getDelegationsRaw(address: string): Promise<Delegation[]> {
    try {
      const response = await this.post('', {
        type: "delegations",
        user: address
      }) as Delegation[];
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }
} 