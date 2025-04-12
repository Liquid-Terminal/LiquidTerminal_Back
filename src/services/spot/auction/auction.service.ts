import { SpotDeployStateApiService } from './auctionTiming.service';
import { HypurrscanClient } from '../../../clients/hypurrscan/hypurrscan.client';
import { AuctionInfo, AuctionTimingInfo } from '../../../types/auction.types';
import { HyperliquidSpotClient } from '../../../clients/hyperliquid/spot/spot.assetcontext.client';
import { redisService } from '../../../core/redis.service';

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
          console.log(`Hypurrscan cache updated at ${new Date(timestamp).toISOString()}`);
        }
      } catch (error) {
        console.error('Error processing cache update:', error);
      }
    });
  }

  public async getAllAuctions(): Promise<AuctionInfo[]> {
    const auctions = await this.hypurrscanClient.getPastAuctions();
    const [spotContext] = await this.spotClient.getSpotMetaAndAssetCtxsRaw();

    return auctions.map(auction => {
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
  }

  public async getAuctionTiming(): Promise<AuctionTimingInfo> {
    return this.spotDeployStateApi.getAuctionTiming();
  }
}