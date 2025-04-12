import { BaseApiService } from '../../../core/base.api.service';
import { TokenInfoResponse } from '../../../types/market.types';
import { CircuitBreakerService } from '../../../core/circuit.breaker.service';
import { RateLimiterService } from '../../../core/hyperLiquid.ratelimiter.service';
import { redisService } from '../../../core/redis.service';

export class HyperliquidTokenInfoClient extends BaseApiService {
  private static instance: HyperliquidTokenInfoClient;
  private static readonly API_URL = 'https://api.hyperliquid.xyz/info';
  private static readonly REQUEST_WEIGHT = 20; // Poids standard pour les requêtes info
  private static readonly MAX_WEIGHT_PER_MINUTE = 1200;
  private readonly CACHE_KEY = 'token:info:';
  private readonly UPDATE_CHANNEL = 'token:info:updated';
  private readonly UPDATE_INTERVAL = 10000; // 10 secondes
  private lastUpdate: Record<string, number> = {};

  private circuitBreaker: CircuitBreakerService;
  private rateLimiter: RateLimiterService;

  private constructor() {
    super(HyperliquidTokenInfoClient.API_URL);
    this.circuitBreaker = CircuitBreakerService.getInstance('tokenInfo');
    this.rateLimiter = RateLimiterService.getInstance('tokenInfo', {
      maxWeightPerMinute: HyperliquidTokenInfoClient.MAX_WEIGHT_PER_MINUTE,
      requestWeight: HyperliquidTokenInfoClient.REQUEST_WEIGHT
    });
  }

  public static getInstance(): HyperliquidTokenInfoClient {
    if (!HyperliquidTokenInfoClient.instance) {
      HyperliquidTokenInfoClient.instance = new HyperliquidTokenInfoClient();
    }
    return HyperliquidTokenInfoClient.instance;
  }

  /**
   * Récupère les détails bruts d'un token
   */
  public async getTokenDetailsRaw(tokenId: string): Promise<TokenInfoResponse | null> {
    const now = Date.now();
    const cacheKey = `${this.CACHE_KEY}${tokenId}`;
    
    if (now - (this.lastUpdate[tokenId] || 0) >= this.UPDATE_INTERVAL) {
      try {
        const data = await this.circuitBreaker.execute(() => 
          this.post<TokenInfoResponse>('', {
            type: "tokenDetails",
            tokenId
          })
        );
        await redisService.set(cacheKey, JSON.stringify(data));
        await redisService.publish(this.UPDATE_CHANNEL, JSON.stringify({
          type: 'DATA_UPDATED',
          tokenId,
          timestamp: now
        }));
        this.lastUpdate[tokenId] = now;
        return data;
      } catch (error) {
        const cached = await redisService.get(cacheKey);
        if (cached) return JSON.parse(cached) as TokenInfoResponse;
        throw error;
      }
    }

    const cached = await redisService.get(cacheKey);
    if (cached) return JSON.parse(cached) as TokenInfoResponse;

    const data = await this.circuitBreaker.execute(() => 
      this.post<TokenInfoResponse>('', {
        type: "tokenDetails",
        tokenId
      })
    );
    await redisService.set(cacheKey, JSON.stringify(data));
    await redisService.publish(this.UPDATE_CHANNEL, JSON.stringify({
      type: 'DATA_UPDATED',
      tokenId,
      timestamp: now
    }));
    this.lastUpdate[tokenId] = now;
    return data;
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
    return HyperliquidTokenInfoClient.REQUEST_WEIGHT;
  }
} 