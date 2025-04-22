import { PerpMarketData, PerpMarketQueryParams, PaginatedResponse } from '../../types/market.types';
import { HyperliquidPerpClient } from '../../clients/hyperliquid/perp/perp.assetcontext.client';
import { redisService } from '../../core/redis.service';
import { logger } from '../../utils/logger';
import { PerpMarketDataError, PerpCacheError } from '../../errors/perp.errors';
import { logDeduplicator } from '../../utils/logDeduplicator';

export class PerpAssetContextService {
  private readonly UPDATE_CHANNEL = 'perp:data:updated';
  private readonly CACHE_KEY = 'perp:raw_data';
  private lastUpdate: number = 0;
  private readonly MARKET_CACHE_KEY = 'perp:markets';
  
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
  public async getPerpMarketsData(params: PerpMarketQueryParams = {}): Promise<PaginatedResponse<PerpMarketData>> {
    try {
      const raw = await redisService.get(this.MARKET_CACHE_KEY);
      if (!raw) {
        throw new PerpMarketDataError('No perp market data available');
      }
      
      let markets = JSON.parse(raw) as PerpMarketData[];

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
        
        // Gérer les cas où les valeurs sont undefined ou null
        if (valueA === undefined || valueA === null) return 1;
        if (valueB === undefined || valueB === null) return -1;
        
        // Pour les nombres, utiliser une comparaison numérique
        if (typeof valueA === 'number' && typeof valueB === 'number') {
          return multiplier * (valueA - valueB);
        }
        
        // Pour les chaînes, utiliser une comparaison de chaînes
        return multiplier * String(valueA).localeCompare(String(valueB));
      });

      // Appliquer la pagination
      const limit = params.limit || 20;
      const page = params.page || 0;
      const start = page * limit;
      const end = start + limit;
      const paginatedMarkets = markets.slice(start, end);

      logDeduplicator.info('Perp market data retrieved successfully', { 
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
      logger.error('Error retrieving perp market data:', error);
      throw error;
    }
  }

  /**
   * Récupère le poids de la requête pour le rate limiting
   */
  public getRequestWeight(): number {
    return HyperliquidPerpClient.getRequestWeight();
  }
} 