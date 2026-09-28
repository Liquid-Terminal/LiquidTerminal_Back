import {
  HypeDexerBuildersIndexerClient,
  IndexerBuilderDetailQuery,
  IndexerBuilderUsersQuery,
  IndexerBuildersTopQuery,
  IndexerBuildersTimeframe,
} from '../../clients/hypedexer/rest/builders/builders-indexer.client';
import { HLIndexerBuildersClient } from '../../clients/hypedexer/rest/builders/builders-list-poller.client';
import { cacheService } from '../../core/cache.service';
import { HYPEDEXER_BUILDERS_CACHE_KEY, HYPEDEXER_TTL } from '../../constants/hypedexer.cache';

/**
 * Passthrough for HypeDexer /builders/* REST under /indexer/builders. The list
 * itself comes from the Redis key the poller (`builders-list-poller.client.ts`)
 * keeps warm.
 */
export class IndexerBuildersIndexerService {
  private static instance: IndexerBuildersIndexerService;
  private readonly client = HypeDexerBuildersIndexerClient.getInstance();
  private readonly listPoller = HLIndexerBuildersClient.getInstance();

  public static getInstance(): IndexerBuildersIndexerService {
    if (!IndexerBuildersIndexerService.instance) {
      IndexerBuildersIndexerService.instance = new IndexerBuildersIndexerService();
    }
    return IndexerBuildersIndexerService.instance;
  }

  /**
   * Upstream ignores every param of `/builders/list` (same 1 400+ rows, same
   * order, with or without `limit`/`sort`: checked 2026-09-28), so the poller's
   * copy is exactly what a direct call would return — minus ~150 credits.
   */
  public async listBuilders(): Promise<unknown> {
    const response = await this.listPoller.getAllBuilders();
    return response.data;
  }

  public async getGlobalStats(timeframe?: IndexerBuildersTimeframe): Promise<unknown> {
    const tf = timeframe ?? '24h';
    return cacheService.getOrSet(
      HYPEDEXER_BUILDERS_CACHE_KEY.stats(tf),
      () => this.client.getGlobalStats(timeframe),
      HYPEDEXER_TTL.buildersStats
    );
  }

  public async getStatsAllTimeframes(): Promise<unknown> {
    return cacheService.getOrSet(
      HYPEDEXER_BUILDERS_CACHE_KEY.statsAllTimeframes,
      () => this.client.getStatsAllTimeframes(),
      HYPEDEXER_TTL.buildersAllTimeframes
    );
  }

  public async getTopBuilders(params: IndexerBuildersTopQuery = {}): Promise<unknown> {
    const tf = params.timeframe ?? '24h';
    const sort = params.sort ?? 'volume';
    // Bypass cache for non-standard limit requests
    if (params.limit !== undefined && params.limit !== 25) {
      return this.client.getTopBuilders(params);
    }
    return cacheService.getOrSet(
      HYPEDEXER_BUILDERS_CACHE_KEY.top(tf, sort),
      () => this.client.getTopBuilders(params),
      HYPEDEXER_TTL.buildersTop
    );
  }

  public async getBuilderStats(
    builderAddress: string,
    params: IndexerBuilderDetailQuery
  ): Promise<unknown> {
    return this.client.getBuilderStats(builderAddress, params);
  }

  public async getBuilderUsers(
    builderAddress: string,
    params: IndexerBuilderUsersQuery
  ): Promise<unknown> {
    return this.client.getBuilderUsers(builderAddress, params);
  }
}
