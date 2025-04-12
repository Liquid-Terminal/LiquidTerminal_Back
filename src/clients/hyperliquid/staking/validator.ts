import { BaseApiService } from '../../../core/base.api.service';
import { ValidatorSummary } from '../../../types/staking.types';
import { CircuitBreakerService } from '../../../core/circuit.breaker.service';
import { RateLimiterService } from '../../../core/hyperLiquid.ratelimiter.service';
import { redisService } from '../../../core/redis.service';

export class ValidatorClient extends BaseApiService {
  private static instance: ValidatorClient;
  private static readonly API_URL = 'https://api.hyperliquid.xyz/info';
  private static readonly REQUEST_WEIGHT = 20;
  private static readonly MAX_WEIGHT_PER_MINUTE = 1200;

  private readonly CACHE_KEY = 'staking:validators:raw_data';
  private readonly UPDATE_CHANNEL = 'staking:validators:updated';
  private readonly UPDATE_INTERVAL = 30000; // 30 secondes
  private lastUpdate: number = 0;

  private circuitBreaker: CircuitBreakerService;
  private rateLimiter: RateLimiterService;

  private constructor() {
    super(ValidatorClient.API_URL);
    this.circuitBreaker = CircuitBreakerService.getInstance('staking');
    this.rateLimiter = RateLimiterService.getInstance('staking', {
      maxWeightPerMinute: ValidatorClient.MAX_WEIGHT_PER_MINUTE,
      requestWeight: ValidatorClient.REQUEST_WEIGHT
    });
  }

  public static getInstance(): ValidatorClient {
    if (!ValidatorClient.instance) {
      ValidatorClient.instance = new ValidatorClient();
    }
    return ValidatorClient.instance;
  }

  public async getValidatorSummariesRaw(): Promise<ValidatorSummary[]> {
    const now = Date.now();
    
    if (now - this.lastUpdate >= this.UPDATE_INTERVAL) {
      try {
        const data = await this.circuitBreaker.execute(() => 
          this.post<ValidatorSummary[]>('', {
            type: "validatorSummaries"
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
        if (cached) return JSON.parse(cached) as ValidatorSummary[];
        throw error;
      }
    }

    const cached = await redisService.get(this.CACHE_KEY);
    if (cached) return JSON.parse(cached) as ValidatorSummary[];

    const data = await this.circuitBreaker.execute(() => 
      this.post<ValidatorSummary[]>('', {
        type: "validatorSummaries"
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

  public checkRateLimit(ip: string): boolean {
    return this.rateLimiter.checkRateLimit(ip);
  }

  public static getRequestWeight(): number {
    return ValidatorClient.REQUEST_WEIGHT;
  }
} 