import { SpotDeployStateApiService } from './auctionTiming.service';
import { HypurrscanClient } from '../../../clients/hypurrscan/hypurrscan.client';
import { AuctionInfo, AuctionTimingInfo } from '../../../types/auction.types';
import { HyperliquidSpotClient } from '../../../clients/hyperliquid/spot/spot.assetcontext.client';
import { redisService } from '../../../core/redis.service';
import { AuctionError } from '../../../errors/spot.errors';
import { logger } from '../../../utils/logger';

export class AuctionPageService {
  private hypurrscanClient: HypurrscanClient;
  private spotClient: HyperliquidSpotClient;
  private readonly UPDATE_CHANNEL = 'hypurrscan:auctions:updated';

  constructor(
    private spotDeployStateApi: SpotDeployStateApiService
  ) {
    this.hypurrscanClient = HypurrscanClient.getInstance();
    this.spotClient = HyperliquidSpotClient.getInstance();
    this.setupSubscriptions();
  }

  private setupSubscriptions(): void {
    redisService.subscribe(this.UPDATE_CHANNEL, async (message) => {
      try {
        const { type, timestamp } = JSON.parse(message);
        if (type === 'DATA_UPDATED') {
          logger.info('Hypurrscan cache updated', { timestamp });
        }
      } catch (error) {
        logger.error('Error processing cache update:', { error });
      }
    });
  }

  public async getAllAuctions(): Promise<AuctionInfo[]> {
    try {
      const auctions = await this.hypurrscanClient.getPastAuctions();
      const [spotContext] = await this.spotClient.getSpotMetaAndAssetCtxsRaw();

      const enrichedAuctions = auctions.map(auction => {
        const token = spotContext.tokens.find(t => t.name === auction.name);
        if (token) {
          return {
            ...auction,
            tokenId: token.tokenId,
            index: token.index
          };
        }
        return auction;
      });

      logger.info('Auctions retrieved successfully', { 
        count: enrichedAuctions.length 
      });

      return enrichedAuctions;
    } catch (error) {
      logger.error('Error fetching auctions:', { error });
      throw new AuctionError(error instanceof Error ? error.message : 'Failed to fetch auctions');
    }
  }

  public async getAuctionTiming(): Promise<AuctionTimingInfo> {
    try {
      const timing = await this.spotDeployStateApi.getAuctionTiming();
      logger.info('Auction timing retrieved successfully', { 
        currentStartTime: timing.currentAuction.startTime,
        currentEndTime: timing.currentAuction.endTime,
        nextStartTime: timing.nextAuction.startTime
      });
      return timing;
    } catch (error) {
      logger.error('Error fetching auction timing:', { error });
      throw new AuctionError(error instanceof Error ? error.message : 'Failed to fetch auction timing');
    }
  }
}