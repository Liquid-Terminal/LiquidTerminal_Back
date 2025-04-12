import {   FormattedTokenInfo, TokenHolder } from '../../types/market.types';
import { AuctionInfo } from '../../types/auction.types';
import { HyperliquidTokenInfoClient } from '../../clients/hyperliquid/spot/spot.tokeninfo.client';
import { redisService } from '../../core/redis.service';

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
        }
      } catch (error) {
        console.error('Error processing cache update:', error);
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
  public async getTokenInfo(tokenId: string): Promise<FormattedTokenInfo | null> {
    try {
      const data = await this.hyperliquidClient.getTokenDetailsRaw(tokenId);
      
      if (!data) return null;
      
      // Formater les données pour inclure les holders de manière plus lisible
      const holders = this.formatHolders(data.genesis.userBalances);
      const nonCirculatingHolders = this.formatHolders(data.nonCirculatingUserBalances);

      return {
        ...data,
        holders,
        nonCirculatingHolders
      };
    } catch (error) {
      console.error('Error formatting token info:', error);
      return null;
    }
  }

  /**
   * Récupère les détails d'un token pour les besoins de l'auction
   */
  public async getTokenAuctionDetails(tokenId: string): Promise<AuctionInfo | null> {
    try {
      const details = await this.hyperliquidClient.getTokenDetailsRaw(tokenId);
      if (!details) return null;

      return {
        time: new Date(details.deployTime).getTime(),
        deployer: details.deployer,
        name: details.name,
        deployGas: details.deployGas
      };
    } catch (error) {
      console.error('Error fetching token auction details:', error);
      return null;
    }
  }

  /**
   * Récupère le poids de la requête pour le rate limiting
   */
  public getRequestWeight(): number {
    return HyperliquidTokenInfoClient.getRequestWeight();
  }
} 