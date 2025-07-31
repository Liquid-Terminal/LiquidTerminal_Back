import { BaseApiService } from '../../../core/base.api.service';
import { SpotContext, AssetContext, Market, Token, MarketData } from '../../../types/market.types';
import { CircuitBreakerService } from '../../../core/circuit.breaker.service';
import { RateLimiterService } from '../../../core/hyperLiquid.ratelimiter.service';
import { redisService } from '../../../core/redis.service';
import { logDeduplicator } from '../../../utils/logDeduplicator';
import * as unitTokens from './unit.json';

export class HyperliquidSpotClient extends BaseApiService {
  private static instance: HyperliquidSpotClient;
  private static readonly API_URL = 'https://api.hyperliquid.xyz/info';
  private static readonly REQUEST_WEIGHT = 20;
  private static readonly MAX_WEIGHT_PER_MINUTE = 1200;

  private readonly CACHE_KEY_RAW = 'spot:raw_data';
  private readonly CACHE_KEY_MARKETS = 'spot:markets';
  private readonly CACHE_KEY_TOKENS = 'spot:tokens:without_pairs';
  private readonly UPDATE_CHANNEL = 'spot:data:updated';
  private readonly UPDATE_INTERVAL = 10000;
  private pollingInterval: NodeJS.Timeout | null = null;

  private circuitBreaker: CircuitBreakerService;
  private rateLimiter: RateLimiterService;

  private constructor() {
    super(HyperliquidSpotClient.API_URL);
    this.circuitBreaker = CircuitBreakerService.getInstance('spot');
    this.rateLimiter = RateLimiterService.getInstance('spot', {
      maxWeightPerMinute: HyperliquidSpotClient.MAX_WEIGHT_PER_MINUTE,
      requestWeight: HyperliquidSpotClient.REQUEST_WEIGHT,
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
    this.updateSpotData().catch(err =>
      logDeduplicator.error('Error in initial spot update:', { error: err })
    );

    this.pollingInterval = setInterval(() => {
      this.updateSpotData().catch(err =>
        logDeduplicator.error('Error in spot polling:', { error: err })
      );
    }, this.UPDATE_INTERVAL);
  }

  private async updateSpotData(): Promise<void> {
    try {
      logDeduplicator.info('Making API call to Hyperliquid...');
      
      // ✅ TEST : Désactiver temporairement l'appel API
      logDeduplicator.info('API call disabled for testing - using mock data');
      
      // Mock data pour tester
      const mockMarkets = [
        {
          name: "BTC",
          logo: "https://app.hyperliquid.xyz/coins/BTC_USDC.svg",
          price: 50000,
          marketCap: 1000000000,
          volume: 1000000,
          change24h: 2.5,
          liquidity: 50000,
          supply: 20000,
          marketIndex: 1,
        }
      ];
      
      logDeduplicator.info('Caching mock data to Redis...');
      await Promise.all([
        redisService.set(this.CACHE_KEY_RAW, JSON.stringify([])),
        redisService.set(this.CACHE_KEY_MARKETS, JSON.stringify(mockMarkets)),
        redisService.set(this.CACHE_KEY_TOKENS, JSON.stringify([]))
      ]);

      logDeduplicator.info('Publishing update event...');
      await redisService.publish(this.UPDATE_CHANNEL, JSON.stringify({
        type: 'DATA_UPDATED',
        timestamp: Date.now(),
      }));

      logDeduplicator.info('Spot data updated & cached (MOCK)', {
        markets: mockMarkets.length,
        tokensWithoutPairs: 0,
      });
    } catch (error) {
      logDeduplicator.error('Failed to update spot data:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        type: error instanceof Error ? error.constructor.name : typeof error
      });
    }
  }

  public static getRequestWeight(): number {
    return HyperliquidSpotClient.REQUEST_WEIGHT;
  }

  /**
   * Vérifie si une requête peut être effectuée selon les rate limits
   * @param ip Adresse IP du client
   */
  public checkRateLimit(ip: string): boolean {
    return this.rateLimiter.checkRateLimit(ip);
  }
}
