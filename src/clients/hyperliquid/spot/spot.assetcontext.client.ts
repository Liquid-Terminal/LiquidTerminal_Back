import { BaseApiService } from '../../../core/base.api.service';
import {  SpotContext, AssetContext } from '../../../types/market.types';
import { CircuitBreakerService } from '../../../core/circuit.breaker.service';
import { RateLimiterService } from '../../../core/hyperLiquid.ratelimiter.service';
import { redisService } from '../../../core/redis.service';
import { logDeduplicator } from '../../../utils/logDeduplicator';

export class HyperliquidSpotClient extends BaseApiService {
  private static instance: HyperliquidSpotClient;
  private static readonly API_URL = 'https://api.hyperliquid.xyz/info';
  private static readonly REQUEST_WEIGHT = 20; // Poids standard pour les requêtes info
  private static readonly MAX_WEIGHT_PER_MINUTE = 1200;

  private readonly CACHE_KEY = 'spot:raw_data';
  private readonly UPDATE_CHANNEL = 'spot:data:updated';
  private readonly UPDATE_INTERVAL = 10000; // 10 secondes
  private lastUpdate: number = 0;
  private pollingInterval: NodeJS.Timeout | null = null;

  private circuitBreaker: CircuitBreakerService;
  private rateLimiter: RateLimiterService;

  private constructor() {
    super(HyperliquidSpotClient.API_URL);
    this.circuitBreaker = CircuitBreakerService.getInstance('spot');
    this.rateLimiter = RateLimiterService.getInstance('spot', {
      maxWeightPerMinute: HyperliquidSpotClient.MAX_WEIGHT_PER_MINUTE,
      requestWeight: HyperliquidSpotClient.REQUEST_WEIGHT
    });
  }

  public static getInstance(): HyperliquidSpotClient {
    if (!HyperliquidSpotClient.instance) {
      HyperliquidSpotClient.instance = new HyperliquidSpotClient();
    }
    return HyperliquidSpotClient.instance;
  }

  public startPolling(): void {
    if (this.pollingInterval) {
      logDeduplicator.warn('Spot polling already started');
      return;
    }

    logDeduplicator.info('Starting spot polling');
    // Faire une première mise à jour immédiate
    this.updateSpotData().catch(error => {
      logDeduplicator.error('Error in initial spot update:', { error });
    });

    // Démarrer le polling régulier
    this.pollingInterval = setInterval(() => {
      this.updateSpotData().catch(error => {
        logDeduplicator.error('Error in spot polling:', { error });
      });
    }, this.UPDATE_INTERVAL);
  }

  public stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      logDeduplicator.info('Spot polling stopped');
    }
  }

  private async updateSpotData(): Promise<void> {
    try {
      const data = await this.circuitBreaker.execute(() => 
        this.post<[SpotContext, AssetContext[]]>('', {
          type: "spotMetaAndAssetCtxs"
        })
      );
      
      await redisService.set(this.CACHE_KEY, JSON.stringify(data));
      const now = Date.now();
      await redisService.publish(this.UPDATE_CHANNEL, JSON.stringify({
        type: 'DATA_UPDATED',
        timestamp: now
      }));
      this.lastUpdate = now;
      logDeduplicator.info('Spot data updated successfully', {
        assetsCount: data[1].length,
        lastUpdate: this.lastUpdate
      });
    } catch (error) {
      logDeduplicator.error('Failed to update spot data:', { error });
      throw error;
    }
  }

  /**
   * Récupère les données brutes de l'API
   */
  public async getSpotMetaAndAssetCtxsRaw(): Promise<[SpotContext, AssetContext[]]> {
    try {
      const cached = await redisService.get(this.CACHE_KEY);
      if (cached) {
        logDeduplicator.info('Retrieved spot data from cache', {
          lastUpdate: this.lastUpdate
        });
        return JSON.parse(cached) as [SpotContext, AssetContext[]];
      }

      logDeduplicator.warn('No spot data in cache, forcing update');
      await this.updateSpotData();
      const freshData = await redisService.get(this.CACHE_KEY);
      if (!freshData) {
        throw new Error('Failed to get spot data after update');
      }
      return JSON.parse(freshData) as [SpotContext, AssetContext[]];
    } catch (error) {
      logDeduplicator.error('Error fetching spot data:', { error });
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
    return HyperliquidSpotClient.REQUEST_WEIGHT;
  }
} 