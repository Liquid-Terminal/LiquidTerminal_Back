import {
  HypeDexerTwapsClient,
  IndexerTwapsListQuery,
  IndexerTwapsStatsQuery,
  IndexerTwapsUserQuery,
} from '../../clients/hypedexer/rest/twaps/twaps.client';
import { buildHypedexerCacheKey } from '../../clients/hypedexer/rest/shared/hypedexer-cache.helper';
import { cacheService } from '../../core/cache.service';
import { HYPEDEXER_USER_CACHE_KEY, HYPEDEXER_TTL } from '../../constants/hypedexer.cache';

export class IndexerTwapsService {
  private static instance: IndexerTwapsService;
  private readonly client = HypeDexerTwapsClient.getInstance();

  public static getInstance(): IndexerTwapsService {
    if (!IndexerTwapsService.instance) {
      IndexerTwapsService.instance = new IndexerTwapsService();
    }
    return IndexerTwapsService.instance;
  }

  /** TWAP flow card: 150 rows polled every minute by each /market visitor. */
  public listTwaps(params: IndexerTwapsListQuery): Promise<unknown> {
    return cacheService.getOrSet(
      buildHypedexerCacheKey('twaps', 'list', { ...params }),
      () => this.client.listTwaps(params),
      HYPEDEXER_TTL.marketList
    );
  }

  public getStats(params: IndexerTwapsStatsQuery): Promise<unknown> {
    return this.client.getStats(params);
  }

  public getUserTwaps(userAddress: string, params: IndexerTwapsUserQuery): Promise<unknown> {
    // IndexerTwapsUserQuery has no date params — always cache
    return cacheService.getOrSet(
      HYPEDEXER_USER_CACHE_KEY.twaps(userAddress, params),
      () => this.client.getUserTwaps(userAddress, params),
      HYPEDEXER_TTL.userAddress
    );
  }

  public getTwap(twapId: string): Promise<unknown> {
    return this.client.getTwap(twapId);
  }

  public getTwapFills(
    twapId: string,
    params: { limit?: number; offset?: number; order?: string }
  ): Promise<unknown> {
    return this.client.getTwapFills(twapId, params);
  }
}
