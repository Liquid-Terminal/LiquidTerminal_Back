import { BaseApiService } from '../../core/base.api.service';
import { SpotUSDCData } from '../../types/market.types';
import { USDCDataError } from '../../errors/spot.errors';
import { logDeduplicator } from '../../utils/logDeduplicator';
import { redisService } from '../../core/redis.service';
import { CircuitBreakerService } from '../../core/circuit.breaker.service';
import { RateLimiterService } from '../../core/hyperLiquid.ratelimiter.service';

export class SpotUSDCClient extends BaseApiService {
  private static instance: SpotUSDCClient;
  private static readonly API_URL = 'https://api.hypurrscan.io';
  private static readonly REQUEST_WEIGHT = 1;
  private static readonly MAX_WEIGHT_PER_MINUTE = 1000;
  private static readonly UPDATE_INTERVAL = 60 * 60 * 1000; // 1 heure en millisecondes
  private static readonly CACHE_KEY = 'hypurrscan:spotUSDC:data';
  private static readonly UPDATE_CHANNEL = 'hypurrscan:spotUSDC:updated';

  private circuitBreaker: CircuitBreakerService;
  private rateLimiter: RateLimiterService;
  private lastUpdate: number = 0;
  private pollingInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super(SpotUSDCClient.API_URL);
    this.circuitBreaker = CircuitBreakerService.getInstance('spotUSDC');
    this.rateLimiter = RateLimiterService.getInstance('spotUSDC', {
      maxWeightPerMinute: SpotUSDCClient.MAX_WEIGHT_PER_MINUTE,
      requestWeight: SpotUSDCClient.REQUEST_WEIGHT
    });
  }

  public static getInstance(): SpotUSDCClient {
    if (!SpotUSDCClient.instance) {
      SpotUSDCClient.instance = new SpotUSDCClient();
    }
    return SpotUSDCClient.instance;
  }

  public startPolling(): void {
    if (this.pollingInterval) {
      logDeduplicator.warn('SpotUSDC polling already started');
      return;
    }

    logDeduplicator.info('Starting SpotUSDC polling');
    // Faire une première mise à jour immédiate
    this.updateSpotUSDCData().catch(error => {
      logDeduplicator.error('Error in initial SpotUSDC update:', { error });
    });

    // Démarrer le polling régulier
    this.pollingInterval = setInterval(() => {
      this.updateSpotUSDCData().catch(error => {
        logDeduplicator.error('Error in SpotUSDC polling:', { error });
      });
    }, SpotUSDCClient.UPDATE_INTERVAL);
  }

  public stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      logDeduplicator.info('SpotUSDC polling stopped');
    }
  }

  private async updateSpotUSDCData(): Promise<void> {
    try {
      const data = await this.circuitBreaker.execute(() => 
        this.get<SpotUSDCData>('/spotUSDC')
      );
      
      if (data) {
        await redisService.set(SpotUSDCClient.CACHE_KEY, JSON.stringify(data));
        const now = Date.now();
        await redisService.publish(SpotUSDCClient.UPDATE_CHANNEL, JSON.stringify({
          type: 'DATA_UPDATED',
          timestamp: now
        }));
        this.lastUpdate = now;
        logDeduplicator.info('SpotUSDC data updated successfully', {
          lastUpdate: data.lastUpdate,
          totalSpotUSDC: data.totalSpotUSDC
        });
      }
    } catch (error) {
      logDeduplicator.error('Failed to update SpotUSDC data:', { error });
      throw error;
    }
  }

  /**
   * Récupère les données USDC spot sur Hyperliquid
   */
  public async getSpotUSDCData(): Promise<SpotUSDCData> {
    try {
      const cachedData = await redisService.get(SpotUSDCClient.CACHE_KEY);
      
      if (cachedData) {
        return JSON.parse(cachedData) as SpotUSDCData;
      }
      
      // Si pas de données en cache, essayer de les récupérer directement
      return await this.circuitBreaker.execute(() => 
        this.get<SpotUSDCData>('/spotUSDC')
      );
    } catch (error) {
      logDeduplicator.error('Error retrieving SpotUSDC data:', { error });
      throw new USDCDataError(error instanceof Error ? error.message : 'Failed to fetch USDC data');
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
    return SpotUSDCClient.REQUEST_WEIGHT;
  }
} 