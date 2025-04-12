import { BaseApiService } from '../../../core/base.api.service';
import { PerpMarket, PerpAssetContext } from '../../../types/market.types';
import { CircuitBreakerService } from '../../../core/circuit.breaker.service';
import { RateLimiterService } from '../../../core/hyperLiquid.ratelimiter.service';
import { redisService } from '../../../core/redis.service';

export class HyperliquidPerpClient extends BaseApiService {
  private static instance: HyperliquidPerpClient;
  private static readonly API_URL = 'https://api.hyperliquid.xyz/info';
  private static readonly REQUEST_WEIGHT = 20; // Poids standard pour les requêtes info
  private static readonly MAX_WEIGHT_PER_MINUTE = 1200;

  private readonly CACHE_KEY = 'perp:raw_data';
  private readonly UPDATE_CHANNEL = 'perp:data:updated';
  private readonly UPDATE_INTERVAL = 10000; // 10 secondes
  private lastUpdate: number = 0;

  private circuitBreaker: CircuitBreakerService;
  private rateLimiter: RateLimiterService;

  private constructor() {
    super(HyperliquidPerpClient.API_URL);
    this.circuitBreaker = CircuitBreakerService.getInstance('perp');
    this.rateLimiter = RateLimiterService.getInstance('perp', {
      maxWeightPerMinute: HyperliquidPerpClient.MAX_WEIGHT_PER_MINUTE,
      requestWeight: HyperliquidPerpClient.REQUEST_WEIGHT
    });
  }

  public static getInstance(): HyperliquidPerpClient {
    if (!HyperliquidPerpClient.instance) {
      HyperliquidPerpClient.instance = new HyperliquidPerpClient();
    }
    return HyperliquidPerpClient.instance;
  }

  /**
   * Récupère les données brutes de l'API
   */
  public async getMetaAndAssetCtxsRaw(): Promise<[{ universe: PerpMarket[] }, PerpAssetContext[]]> {
    const now = Date.now();
    
    if (now - this.lastUpdate >= this.UPDATE_INTERVAL) {
      try {
        const data = await this.circuitBreaker.execute(() => 
          this.post<[{ universe: PerpMarket[] }, PerpAssetContext[]]>('', {
            type: "metaAndAssetCtxs"
          })
        );
        await redisService.set(this.CACHE_KEY, JSON.stringify(data));
        await redisService.publish(this.UPDATE_CHANNEL, JSON.stringify({
          type: 'DATA_UPDATED',
          timestamp: now
        }));
        this.lastUpdate = now;
        return data;
      } catch (error) {
        const cached = await redisService.get(this.CACHE_KEY);
        if (cached) return JSON.parse(cached) as [{ universe: PerpMarket[] }, PerpAssetContext[]];
        throw error;
      }
    }

    const cached = await redisService.get(this.CACHE_KEY);
    if (cached) return JSON.parse(cached) as [{ universe: PerpMarket[] }, PerpAssetContext[]];

    const data = await this.circuitBreaker.execute(() => 
      this.post<[{ universe: PerpMarket[] }, PerpAssetContext[]]>('', {
        type: "metaAndAssetCtxs"
      })
    );
    await redisService.set(this.CACHE_KEY, JSON.stringify(data));
    await redisService.publish(this.UPDATE_CHANNEL, JSON.stringify({
      type: 'DATA_UPDATED',
      timestamp: now
    }));
    this.lastUpdate = now;
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
    return HyperliquidPerpClient.REQUEST_WEIGHT;
  }
} 