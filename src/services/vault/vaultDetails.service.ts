import { VaultDetails } from '../../types/vault.types';
import { HyperliquidVaultClient } from '../../clients/hyperliquid/vault/vault.client';

export class VaultDetailsService {
  private hyperliquidClient: HyperliquidVaultClient;

  constructor() {
    this.hyperliquidClient = HyperliquidVaultClient.getInstance();
  }

  /**
   * Récupère les détails du vault pour une adresse donnée
   * @param address L'adresse de l'utilisateur
   */
  public async getVaultDetailsRaw(address: string): Promise<VaultDetails> {
    try {
      return await this.hyperliquidClient.getVaultDetailsRaw(address);
    } catch (error) {
      console.error('Error fetching vault details:', error);
      throw error;
    }
  }

  /**
   * Récupère le poids de la requête pour le rate limiting
   */
  public getRequestWeight(): number {
    return HyperliquidVaultClient.getRequestWeight();
  }
} 