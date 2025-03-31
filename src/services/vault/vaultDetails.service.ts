import { BaseApiService } from '../base/base.api.service';
import { VaultDetails, VaultDetailsRequest } from '../../types/vault.types';

export class VaultDetailsService extends BaseApiService {
  constructor() {
    super('https://api.hyperliquid.xyz/info');
  }

  /**
   * Récupère les détails d'un vault spécifique
   * @param vaultAddress Adresse du vault au format hexadécimal
   * @param user Adresse de l'utilisateur (optionnel)
   */
  public async getVaultDetails(vaultAddress: string, user?: string): Promise<VaultDetails> {
    try {
      const request: VaultDetailsRequest = {
        type: "vaultDetails",
        vaultAddress: vaultAddress
      };

      // Ajouter l'utilisateur à la requête s'il est fourni
      if (user) {
        request.user = user;
      }

      const response = await this.post('', request) as VaultDetails;
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }
} 