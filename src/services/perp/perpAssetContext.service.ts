import { PerpMarketData, PerpMarket, PerpAssetContext } from '../../types/market.types';
import { HyperliquidPerpClient } from '../../clients/hyperliquid/perp/perp.assetcontext.client';
import { redisService } from '../../core/redis.service';
import { logger } from '../../utils/logger';
import { PerpMarketDataError, PerpCacheError } from '../../errors/perp.errors';
import { logDeduplicator } from '../../utils/logDeduplicator';

export class PerpAssetContextService {
  private readonly UPDATE_CHANNEL = 'perp:data:updated';
  private readonly CACHE_KEY = 'perp:raw_data';
  private lastUpdate: number = 0;
  
  constructor() {
    this.setupSubscriptions();
  }

  private setupSubscriptions(): void {
    redisService.subscribe(this.UPDATE_CHANNEL, async (message) => {
      try {
        const { type, timestamp } = JSON.parse(message);
        if (type === 'DATA_UPDATED') {
          this.lastUpdate = timestamp;
          logDeduplicator.info('Perp data cache updated', { timestamp });
        }
      } catch (error) {
        logger.error('Error processing cache update:', { error });
        throw new PerpCacheError('Failed to process cache update message');
      }
    });
  }

  /**
   * Calcule la variation en pourcentage entre deux prix
   */
  private calculatePriceChange(currentPrice: number, previousPrice: number): number {
    if (previousPrice === 0) return 0;
    return Number(((currentPrice - previousPrice) / previousPrice * 100).toFixed(2));
  }

  /**
   * Récupère les données des marchés perpétuels depuis le cache
   */
  public async getPerpMarketsData(): Promise<PerpMarketData[]> {
    try {
      const cachedData = await redisService.get(this.CACHE_KEY);
      if (!cachedData) {
        throw new PerpCacheError('No data available in cache');
      }

      const [meta, assetContexts] = JSON.parse(cachedData) as [{ universe: PerpMarket[] }, PerpAssetContext[]];

      const marketsData = meta.universe.map((market: PerpMarket, index: number) => {
        const assetContext = assetContexts[index];
        const currentPrice = Number(assetContext.markPx);
        const prevDayPrice = Number(assetContext.prevDayPx);

        return {
          name: market.name,
          price: currentPrice,
          change24h: this.calculatePriceChange(currentPrice, prevDayPrice),
          volume: Number(assetContext.dayNtlVlm),
          openInterest: Number(assetContext.openInterest),
          funding: Number(assetContext.funding),
          maxLeverage: market.maxLeverage,
          onlyIsolated: market.onlyIsolated || false
        };
      });

      logDeduplicator.info('Perp markets data retrieved from cache', { 
        count: marketsData.length,
        lastUpdate: this.lastUpdate
      });

      return marketsData;
    } catch (error) {
      logger.error('Error retrieving perp markets data from cache:', { error });
      throw new PerpMarketDataError('Failed to retrieve market data from cache');
    }
  }

  /**
   * Récupère le poids de la requête pour le rate limiting
   */
  public getRequestWeight(): number {
    return HyperliquidPerpClient.getRequestWeight();
  }
} 