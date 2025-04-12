import { BaseApiService } from '../../../core/base.api.service';
import { GasAuctionResponse } from '../../../types/auction.types';
import { CircuitBreakerService } from '../../../core/circuit.breaker.service';
import { RateLimiterService } from '../../../core/hyperLiquid.ratelimiter.service';

export class HyperliquidSpotDeployClient extends BaseApiService {
  private static instance: HyperliquidSpotDeployClient;
  private static readonly API_URL = 'https://api-ui.hyperliquid.xyz/info';
  private static readonly REQUEST_WEIGHT = 20; // Poids standard pour les requêtes info
  private static readonly MAX_WEIGHT_PER_MINUTE = 1200;

  private circuitBreaker: CircuitBreakerService;
  private rateLimiter: RateLimiterService;

  private constructor() {
    super(HyperliquidSpotDeployClient.API_URL);
    this.circuitBreaker = CircuitBreakerService.getInstance('spotDeploy');
    this.rateLimiter = RateLimiterService.getInstance('spotDeploy', {
      maxWeightPerMinute: HyperliquidSpotDeployClient.MAX_WEIGHT_PER_MINUTE,
      requestWeight: HyperliquidSpotDeployClient.REQUEST_WEIGHT
    });
  }

  public static getInstance(): HyperliquidSpotDeployClient {
    if (!HyperliquidSpotDeployClient.instance) {
      HyperliquidSpotDeployClient.instance = new HyperliquidSpotDeployClient();
    }
    return HyperliquidSpotDeployClient.instance;
  }

  /**
   * Récupère l'état du déploiement spot
   */
  public async getSpotDeployState(): Promise<GasAuctionResponse | null> {
    return this.circuitBreaker.execute(() => 
      this.post<GasAuctionResponse>('', {
        type: "spotDeployState",
        user: "0x0000000000000000000000000000000000000000" // Adresse à confirmer
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
    return HyperliquidSpotDeployClient.REQUEST_WEIGHT;
  }
} 