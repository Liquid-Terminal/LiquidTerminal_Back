import { BaseApiService } from '../../../core/base.api.service';
import { VaultDetails } from '../../../types/vault.types';
import { CircuitBreakerService } from '../../../core/circuit.breaker.service';
import { RateLimiterService } from '../../../core/hyperLiquid.ratelimiter.service';

export class HyperliquidVaultClient extends BaseApiService {
  private static instance: HyperliquidVaultClient;
  private static readonly API_URL = 'https://api.hyperliquid.xyz/info';
  private static readonly REQUEST_WEIGHT = 20; // Poids standard pour les requêtes info
  private static readonly MAX_WEIGHT_PER_MINUTE = 1200;

  private circuitBreaker: CircuitBreakerService;
  private rateLimiter: RateLimiterService;

  private constructor() {
    super(HyperliquidVaultClient.API_URL);
    this.circuitBreaker = CircuitBreakerService.getInstance('vault');
    this.rateLimiter = RateLimiterService.getInstance('vault', {
      maxWeightPerMinute: HyperliquidVaultClient.MAX_WEIGHT_PER_MINUTE,
      requestWeight: HyperliquidVaultClient.REQUEST_WEIGHT
    });
  }

  public static getInstance(): HyperliquidVaultClient {
    if (!HyperliquidVaultClient.instance) {
      HyperliquidVaultClient.instance = new HyperliquidVaultClient();
    }
    return HyperliquidVaultClient.instance;
  }

  /**
   * Récupère les détails du vault pour une adresse donnée
   */
  public async getVaultDetailsRaw(address: string): Promise<VaultDetails> {
    return this.circuitBreaker.execute(() => 
      this.post<VaultDetails>('', {
        type: "vaultDetails",
        user: address
      })
    );
  }

  /**
   * Vérifie si une requête peut être effectuée selon les rate limits
   * @param ip Adresse IP du client
   */
  public checkRateLimit(ip: string): boolean {
    return this.rateLimiter.checkRateLimit(ip);
  }

  /**
   * Retourne le poids de la requête pour le rate limiting
   */
  public static getRequestWeight(): number {
    return HyperliquidVaultClient.REQUEST_WEIGHT;
  }
} 