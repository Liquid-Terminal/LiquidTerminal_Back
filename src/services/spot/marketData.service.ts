import { MarketData, SpotContext, AssetContext, Token, Market } from '../../types/market.types';
import { redisService } from '../../core/redis.service';
import { MarketDataError } from '../../errors/spot.errors';
import { logger, measureExecutionTime } from '../../utils/logger';
import { logDeduplicator } from '../../utils/logDeduplicator';

export class SpotAssetContextService {
  private readonly UPDATE_CHANNEL = 'spot:data:updated';
  private readonly CACHE_KEY = 'spot:raw_data';
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
          logDeduplicator.info('Spot data cache updated', { timestamp });
        }
      } catch (error) {
        logger.error('Error processing cache update:', { error });
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
   * Récupère les données de marché depuis le cache
   */
  public async getMarketsData(): Promise<MarketData[]> {
    return measureExecutionTime(async () => {
      try {
        const cachedData = await redisService.get(this.CACHE_KEY);
        if (!cachedData) {
          throw new MarketDataError('No data available in cache');
        }

        const [spotData, assetContexts] = JSON.parse(cachedData) as [SpotContext, AssetContext[]];
        
        const tokenMap = spotData.tokens.reduce((acc: Record<number, Token>, token: Token) => {
          acc[token.index] = token;
          return acc;
        }, {} as Record<number, Token>);

        const marketsData = await Promise.all(
          spotData.universe.map(async (market: Market) => {
            try {
              const assetContext = assetContexts.find((ctx: AssetContext) => ctx.coin === market.name);
              if (!assetContext) {
                logDeduplicator.info('No asset context found', { market: market.name });
                return null;
              }

              const tokenIndex = market.tokens[0];
              const token = tokenMap[tokenIndex];
              if (!token) {
                logDeduplicator.info('No token found', { index: tokenIndex });
                return null;
              }

              const currentPrice = Number(assetContext.markPx);
              const prevDayPrice = Number(assetContext.prevDayPx);
              const circulatingSupply = Number(assetContext.circulatingSupply);
              const volume = Number(assetContext.dayNtlVlm);
              const marketCap = currentPrice * circulatingSupply;

              return {
                name: token.name,
                logo: null,
                price: currentPrice,
                marketCap: marketCap,
                volume: volume,
                change24h: this.calculatePriceChange(currentPrice, prevDayPrice),
                liquidity: Number(assetContext.midPx),
                supply: circulatingSupply
              };
            } catch (error) {
              logger.error('Error processing market:', { error, market: market.name });
              return null;
            }
          })
        );

        const validMarketsData = marketsData
          .filter(Boolean)
          .sort((a, b) => b!.marketCap - a!.marketCap) as MarketData[];

        logDeduplicator.info('Market data retrieved from cache', { 
          count: validMarketsData.length,
          lastUpdate: this.lastUpdate
        });

        return validMarketsData;
      } catch (error) {
        logger.error('Error retrieving market data from cache:', { error });
        throw new MarketDataError('Failed to retrieve market data from cache');
      }
    }, 'getMarketsData');
  }

  /**
   * Récupère les tokens sans paires depuis le cache
   */
  public async getTokensWithoutPairs(): Promise<string[]> {
    try {
      const cachedData = await redisService.get(this.CACHE_KEY);
      if (!cachedData) {
        throw new MarketDataError('No data available in cache');
      }

      const [spotData] = JSON.parse(cachedData) as [SpotContext, AssetContext[]];
      
      const tokens = spotData.tokens
        .filter((token: Token) => !spotData.universe.some((market: Market) => 
          market.tokens[0] === token.index
        ))
        .map((token: Token) => token.name);

      logDeduplicator.info('Tokens without pairs retrieved from cache', { 
        count: tokens.length 
      });

      return tokens;
    } catch (error) {
      logger.error('Error retrieving tokens without pairs from cache:', { error });
      throw new MarketDataError('Failed to retrieve tokens without pairs from cache');
    }
  }

  /**
   * Récupère uniquement les IDs des tokens depuis le cache
   */
  public async getTokenIds(): Promise<string[]> {
    try {
      const cachedData = await redisService.get(this.CACHE_KEY);
      if (!cachedData) {
        throw new MarketDataError('No data available in cache');
      }

      const [spotData] = JSON.parse(cachedData) as [SpotContext, AssetContext[]];
      const tokenIds = spotData.tokens
        .filter((token: Token) => token.tokenId)
        .map((token: Token) => token.tokenId);

      logDeduplicator.info('Token IDs retrieved from cache', { 
        count: tokenIds.length 
      });

      return tokenIds;
    } catch (error) {
      logger.error('Error retrieving token IDs from cache:', { error });
      throw new MarketDataError('Failed to retrieve token IDs from cache');
    }
  }
}