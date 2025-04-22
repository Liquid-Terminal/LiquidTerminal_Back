import { SpotDeployStateApiService } from './auctionTiming.service';
import { AuctionInfo, AuctionTimingInfo } from '../../../types/auction.types';
import { Token } from '../../../types/market.types';
import { redisService } from '../../../core/redis.service';
import { AuctionError } from '../../../errors/spot.errors';
import { logDeduplicator } from '../../../utils/logDeduplicator';

export class AuctionPageService {
  private readonly UPDATE_CHANNEL = 'hypurrscan:auctions:updated';
  private readonly CACHE_KEY = 'hypurrscan:auctions';
  private readonly SPOT_CACHE_KEY = 'spot:raw_data';

  constructor(
    private spotDeployStateApi: SpotDeployStateApiService
  ) {
    this.setupSubscriptions();
  }

  private setupSubscriptions(): void {
    redisService.subscribe(this.UPDATE_CHANNEL, async (message) => {
      try {
        const { type, timestamp } = JSON.parse(message);
        if (type === 'DATA_UPDATED') {
          logDeduplicator.info('Hypurrscan cache updated', { timestamp });
        }
      } catch (error) {
        logDeduplicator.error('Error processing cache update:', { error });
      }
    });
  }

  public async getAllAuctions(): Promise<AuctionInfo[]> {
    try {
      const cachedData = await redisService.get(this.CACHE_KEY);
      if (!cachedData) {
        logDeduplicator.error('No auction data in cache');
        throw new AuctionError('No auction data available in cache');
      }

      const spotCachedData = await redisService.get(this.SPOT_CACHE_KEY);
      if (!spotCachedData) {
        logDeduplicator.error('No spot data in cache');
        throw new AuctionError('No spot data available in cache');
      }

      const auctions = JSON.parse(cachedData) as AuctionInfo[];
      const [spotContext] = JSON.parse(spotCachedData);

      if (!spotContext || !spotContext.tokens) {
        logDeduplicator.error('Invalid spot data format in cache');
        throw new AuctionError('Invalid spot data format');
      }

      const enrichedAuctions = auctions.map(auction => {
        const token = spotContext.tokens.find((t: Token) => t.name === auction.name);
        if (token) {
          return {
            ...auction,
            tokenId: token.tokenId,
            index: token.index
          };
        }
        return auction;
      });

      logDeduplicator.info('Auctions retrieved successfully', { 
        count: enrichedAuctions.length,
        auctionsWithTokens: enrichedAuctions.filter(a => a.tokenId).length
      });

      return enrichedAuctions;
    } catch (error) {
      if (error instanceof AuctionError) {
        throw error;
      }
      logDeduplicator.error('Error retrieving auctions:', { error });
      throw new AuctionError('Failed to retrieve auctions data');
    }
  }

  public async getAuctionTiming(): Promise<AuctionTimingInfo> {
    try {
      const timing = await this.spotDeployStateApi.getAuctionTiming();
      logDeduplicator.info('Auction timing retrieved successfully', { 
        currentStartTime: timing.currentAuction.startTime,
        currentEndTime: timing.currentAuction.endTime,
        nextStartTime: timing.nextAuction.startTime
      });
      return timing;
    } catch (error) {
      logDeduplicator.error('Error fetching auction timing:', { error });
      throw new AuctionError(error instanceof Error ? error.message : 'Failed to fetch auction timing');
    }
  }
}