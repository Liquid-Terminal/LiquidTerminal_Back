import { BaseApiService } from '../../core/base.api.service';
import { CircuitBreakerService } from '../../core/circuit.breaker.service';
import { RateLimiterService } from '../../core/hyperLiquid.ratelimiter.service';
import { AuctionInfo } from '../../types/auction.types';
import { redisService } from '../../core/redis.service';

export class HypurrscanClient extends BaseApiService {
  private static instance: HypurrscanClient;
  private static readonly API_URL = 'https://api.hypurrscan.io';
  private static readonly REQUEST_WEIGHT = 1;
  private static readonly MAX_WEIGHT_PER_MINUTE = 1000;
  private static readonly UPDATE_INTERVAL = 2000; // 2 secondes
  private static readonly CACHE_KEY = 'hypurrscan:auctions';

  private circuitBreaker: CircuitBreakerService;
  private rateLimiter: RateLimiterService;
  private lastUpdate: number = 0;

  private constructor() {
    super(HypurrscanClient.API_URL);
    this.circuitBreaker = CircuitBreakerService.getInstance('hypurrscan');
    this.rateLimiter = RateLimiterService.getInstance('hypurrscan', {
      maxWeightPerMinute: HypurrscanClient.MAX_WEIGHT_PER_MINUTE,
      requestWeight: HypurrscanClient.REQUEST_WEIGHT
    });
  }

  public static getInstance(): HypurrscanClient {
    if (!HypurrscanClient.instance) {
      HypurrscanClient.instance = new HypurrscanClient();
    }
    return HypurrscanClient.instance;
  }

  /**
   * Récupère les enchères passées depuis l'API hypurrscan.io
   */
  public async getPastAuctions(): Promise<AuctionInfo[]> {
    const now = Date.now();
    if (now - this.lastUpdate < HypurrscanClient.UPDATE_INTERVAL) {
      const cached = await redisService.get(HypurrscanClient.CACHE_KEY);
      if (cached) return JSON.parse(cached);
      return [];
    }

    try {
      const data = await this.circuitBreaker.execute(() => 
        this.get<AuctionInfo[]>('/pastAuctions')
      );
      this.lastUpdate = now;
      await redisService.set(HypurrscanClient.CACHE_KEY, JSON.stringify(data));
      await redisService.publish('hypurrscan:auctions:updated', JSON.stringify({
        type: 'DATA_UPDATED',
        timestamp: now
      }));
      return data;
    } catch (error) {
      console.error('Error fetching past auctions:', error);
      const cached = await redisService.get(HypurrscanClient.CACHE_KEY);
      if (cached) return JSON.parse(cached);
      throw error;
    }
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
    return HypurrscanClient.REQUEST_WEIGHT;
  }
} 