import { MarketData, SpotContext, AssetContext, Token, Market, MarketQueryParams, PaginatedResponse } from '../../types/market.types';
import { redisService } from '../../core/redis.service';
import { MarketDataError } from '../../errors/spot.errors';
import { logDeduplicator } from '../../utils/logDeduplicator';

export class SpotAssetContextService {
  private readonly UPDATE_CHANNEL = 'spot:data:updated';
  private readonly CACHE_KEY = 'spot:raw_data';
  private lastUpdate: Record<string, number> = {};
  private readonly MARKET_CACHE_KEY = 'spot:markets';

  constructor() {
    this.setupSubscriptions();
  }

  private setupSubscriptions(): void {
    redisService.subscribe(this.UPDATE_CHANNEL, async (message) => {
      try {
        const { type, marketName, timestamp } = JSON.parse(message);
        if (type === 'DATA_UPDATED') {
          this.lastUpdate[marketName] = timestamp;
          logDeduplicator.info('Spot market data cache updated', { 
            marketName, 
            timestamp 
          });
        }
      } catch (error) {
        logDeduplicator.error('Error processing cache update:', { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    });
  }

  /**
   * Récupère les données de marché depuis le cache
   */
  public async getMarketsData(params: MarketQueryParams = {}): Promise<PaginatedResponse<MarketData>> {
    try {
      const raw = await redisService.get(this.MARKET_CACHE_KEY);
      if (!raw) {
        throw new MarketDataError('No market data available');
      }
      
      let markets = JSON.parse(raw) as MarketData[];

      // Appliquer les filtres
      if (params.token) {
        markets = markets.filter(market => 
          market.name.toLowerCase().includes(params.token!.toLowerCase())
        );
      }
      if (params.pair) {
        markets = markets.filter(market => 
          market.name.toLowerCase().includes(params.pair!.toLowerCase())
        );
      }

      // Appliquer le tri
      const sortBy = params.sortBy || 'volume';
      const sortOrder = params.sortOrder || 'desc';
      markets.sort((a, b) => {
        const multiplier = sortOrder === 'desc' ? -1 : 1;
        const valueA = a[sortBy];
        const valueB = b[sortBy];
        
        if (valueA === undefined || valueA === null) return 1;
        if (valueB === undefined || valueB === null) return -1;
        
        if (typeof valueA === 'number' && typeof valueB === 'number') {
          return multiplier * (valueA - valueB);
        }
        
        return multiplier * String(valueA).localeCompare(String(valueB));
      });

      // Appliquer la pagination
      const limit = params.limit || 20;
      const page = params.page || 0;
      const start = page * limit;
      const end = start + limit;
      const paginatedMarkets = markets.slice(start, end);

      logDeduplicator.info('Market data retrieved successfully', { 
        count: paginatedMarkets.length,
        total: markets.length,
        page,
        limit
      });

      return {
        data: paginatedMarkets,
        pagination: {
          total: markets.length,
          page,
          limit,
          totalPages: Math.ceil(markets.length / limit)
        }
      };
    } catch (error) {
      logDeduplicator.error('Error retrieving market data:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
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
      logDeduplicator.error('Error retrieving tokens without pairs from cache:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
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
      logDeduplicator.error('Error retrieving token IDs from cache:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw new MarketDataError('Failed to retrieve token IDs from cache');
    }
  }
}