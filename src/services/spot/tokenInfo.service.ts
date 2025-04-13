import {   FormattedTokenInfo, TokenHolder } from '../../types/market.types';
import { AuctionInfo } from '../../types/auction.types';
import { HyperliquidTokenInfoClient } from '../../clients/hyperliquid/spot/spot.tokeninfo.client';
import { redisService } from '../../core/redis.service';
import { TokenInfoError, TokenNotFoundError } from '../../errors/spot.errors';
import { logger } from '../../utils/logger';

export class TokenInfoService {
  private readonly UPDATE_CHANNEL = 'token:info:updated';
  private lastUpdate: Record<string, number> = {};

  constructor(private hyperliquidClient: HyperliquidTokenInfoClient) {
    this.setupSubscriptions();
  }

  private setupSubscriptions(): void {
    redisService.subscribe(this.UPDATE_CHANNEL, async (message) => {
      try {
        const { type, tokenId, timestamp } = JSON.parse(message);
        if (type === 'DATA_UPDATED') {
          this.lastUpdate[tokenId] = timestamp;
          logger.info('Token info cache updated', { tokenId, timestamp });
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
   * Récupère les informations formatées d'un token avec les holders
   */
  public async getTokenInfo(tokenId: string): Promise<FormattedTokenInfo> {
    try {
      const data = await this.hyperliquidClient.getTokenDetailsRaw(tokenId);
      
      if (!data) {
        logger.warn('Token not found', { tokenId });
        throw new TokenNotFoundError(`Token with ID ${tokenId} not found`);
      }
      
      // Formater les données pour inclure les holders de manière plus lisible
      const holders = this.formatHolders(data.genesis.userBalances);
      const nonCirculatingHolders = this.formatHolders(data.nonCirculatingUserBalances);

      logger.info('Token info retrieved successfully', { 
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
      logger.error('Error formatting token info:', { error, tokenId });
      if (error instanceof TokenNotFoundError) {
        throw error;
      }
      throw new TokenInfoError(error instanceof Error ? error.message : 'Failed to fetch token information');
    }
  }

  /**
   * Récupère les détails d'un token pour les besoins de l'auction
   */
  public async getTokenAuctionDetails(tokenId: string): Promise<AuctionInfo> {
    try {
      const details = await this.hyperliquidClient.getTokenDetailsRaw(tokenId);
      if (!details) {
        logger.warn('Token not found for auction details', { tokenId });
        throw new TokenNotFoundError(`Token with ID ${tokenId} not found`);
      }

      logger.info('Token auction details retrieved successfully', { 
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
      logger.error('Error fetching token auction details:', { error, tokenId });
      if (error instanceof TokenNotFoundError) {
        throw error;
      }
      throw new TokenInfoError(error instanceof Error ? error.message : 'Failed to fetch token auction details');
    }
  }

  /**
   * Récupère le poids de la requête pour le rate limiting
   */
  public getRequestWeight(): number {
    return HyperliquidTokenInfoClient.getRequestWeight();
  }
} 