import {
  HypeDexerAnalyticsIndexerClient,
  IndexerAnalyticsFillsStatsQuery,
  IndexerAnalyticsPriorityFeesStatsQuery,
} from '../../clients/hypedexer/rest/analytics/analytics-indexer.client';
import { buildHypedexerCacheKey } from '../../clients/hypedexer/rest/shared/hypedexer-cache.helper';
import { cacheService } from '../../core/cache.service';
import { HYPEDEXER_TTL } from '../../constants/hypedexer.cache';

/** Rolling-window stats (1 to 168 h), shared for a minute per param set. */
export class IndexerAnalyticsService {
  private static instance: IndexerAnalyticsService;
  private readonly client = HypeDexerAnalyticsIndexerClient.getInstance();

  public static getInstance(): IndexerAnalyticsService {
    if (!IndexerAnalyticsService.instance) {
      IndexerAnalyticsService.instance = new IndexerAnalyticsService();
    }
    return IndexerAnalyticsService.instance;
  }

  public async getFillsStats(params: IndexerAnalyticsFillsStatsQuery): Promise<unknown> {
    return cacheService.getOrSet(
      buildHypedexerCacheKey('analytics', 'fills-stats', { ...params }),
      () => this.client.getFillsStats(params),
      HYPEDEXER_TTL.marketList
    );
  }

  public async getPriorityFeesStats(
    params: IndexerAnalyticsPriorityFeesStatsQuery
  ): Promise<unknown> {
    return cacheService.getOrSet(
      buildHypedexerCacheKey('analytics', 'priority-fees-stats', { ...params }),
      () => this.client.getPriorityFeesStats(params),
      HYPEDEXER_TTL.marketList
    );
  }
}
