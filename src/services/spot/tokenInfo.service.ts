import { FormattedTokenInfo, TokenHolder } from '../../types/market.types';
import { AuctionInfo } from '../../types/auction.types';
import { redisService } from '../../core/redis.service';
import { TokenInfoError, TokenNotFoundError } from '../../errors/spot.errors';
import { logger } from '../../utils/logger';
import { logDeduplicator } from '../../utils/logDeduplicator';

export class TokenInfoService {
  private readonly UPDATE_CHANNEL = 'token:info:updated';
  private readonly CACHE_KEY = 'token:info:raw_data';
  private lastUpdate: Record<string, number> = {};

  constructor() {
    this.setupSubscriptions();
  }

  private setupSubscriptions(): void {
    redisService.subscribe(this.UPDATE_CHANNEL, async (message) => {
      try {
        const { type, tokenId, timestamp } = JSON.parse(message);
        if (type === 'DATA_UPDATED') {
          this.lastUpdate[tokenId] = timestamp;
          logDeduplicator.info('Token info cache updated', { tokenId, timestamp });
        }
      } catch (error) {
        logger.error('Error processing cache update:', { error });
      }
    });
  }

  /**
   * Formate les balances des holders
   */
  private formatHolders(balances: [string, string][]): TokenHolder[] {
    return balances.map(([address, balance]) => ({
      address,
      balance
    }));
  }

  /**
   * Récupère les informations formatées d'un token avec les holders depuis le cache
   */
  public async getTokenInfo(tokenId: string): Promise<FormattedTokenInfo> {
    try {
      const cachedData = await redisService.get(`${this.CACHE_KEY}:${tokenId}`);
      if (!cachedData) {
        logger.warn('Token not found in cache', { tokenId });
        throw new TokenNotFoundError(`Token with ID ${tokenId} not found in cache`);
      }

      const data = JSON.parse(cachedData);
      
      // Formater les données pour inclure les holders de manière plus lisible
      const holders = this.formatHolders(data.genesis.userBalances);
      const nonCirculatingHolders = this.formatHolders(data.nonCirculatingUserBalances);

      logDeduplicator.info('Token info retrieved from cache', { 
        tokenId,
        holdersCount: holders.length,
        nonCirculatingHoldersCount: nonCirculatingHolders.length
      });

      return {
        ...data,
        holders,
        nonCirculatingHolders
      };
    } catch (error) {
      logger.error('Error retrieving token info from cache:', { error, tokenId });
      if (error instanceof TokenNotFoundError) {
        throw error;
      }
      throw new TokenInfoError('Failed to retrieve token information from cache');
    }
  }

  /**
   * Récupère les détails d'un token pour les besoins de l'auction depuis le cache
   */
  public async getTokenAuctionDetails(tokenId: string): Promise<AuctionInfo> {
    try {
      const cachedData = await redisService.get(`${this.CACHE_KEY}:${tokenId}`);
      if (!cachedData) {
        logger.warn('Token not found in cache for auction details', { tokenId });
        throw new TokenNotFoundError(`Token with ID ${tokenId} not found in cache`);
      }

      const details = JSON.parse(cachedData);

      logDeduplicator.info('Token auction details retrieved from cache', { 
        tokenId,
        deployTime: new Date(details.deployTime).toISOString()
      });

      return {
        time: new Date(details.deployTime).getTime(),
        deployer: details.deployer,
        name: details.name,
        deployGas: details.deployGas
      };
    } catch (error) {
      logger.error('Error retrieving token auction details from cache:', { error, tokenId });
      if (error instanceof TokenNotFoundError) {
        throw error;
      }
      throw new TokenInfoError('Failed to retrieve token auction details from cache');
    }
  }
} 