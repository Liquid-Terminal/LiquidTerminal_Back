import { VaultDetails } from '../../types/vault.types';
import { HyperliquidVaultClient } from '../../clients/hyperliquid/vault/vault.client';
import { redisService } from '../../core/redis.service';
import { logDeduplicator } from '../../utils/logDeduplicator';

export class VaultDetailsService {
  private hyperliquidClient: HyperliquidVaultClient;
  private readonly CACHE_KEY = 'vault_details';
  private readonly CACHE_DURATION = 60 * 5; // 5 minutes

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
      logDeduplicator.error('Error fetching vault details', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        address
      });
      throw error;
    }
  }

  /**
   * Récupère le poids de la requête pour le rate limiting
   */
  public getRequestWeight(): number {
    return HyperliquidVaultClient.getRequestWeight();
  }

  public async getVaultDetails(): Promise<VaultDetails> {
    try {
      // Vérifier le cache d'abord
      const cachedData = await redisService.get(this.CACHE_KEY);
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      // Si pas de cache, faire l'appel API
      const response = await fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: "vaultDetails" })
      });

      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }

      const data = await response.json();

      // Mettre en cache
      await redisService.set(
        this.CACHE_KEY,
        JSON.stringify(data),
        this.CACHE_DURATION
      );

      return data;
    } catch (error) {
      logDeduplicator.error('Error fetching vault details', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }
} 