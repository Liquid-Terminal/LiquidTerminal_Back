import { HypeDexerElysiumIndexerClient } from '../../clients/hypedexer/rest/elysium/elysium-indexer.client';
import type {
  ElysiumBatchesQuery,
  ElysiumBlocksQuery,
  ElysiumBridgeReservesQuery,
  ElysiumBridgeRetryablesQuery,
  ElysiumBridgeTokensQuery,
  ElysiumBridgeTransfersQuery,
  ElysiumStatsDailyQuery,
  ElysiumTokensQuery,
  ElysiumTransactionsQuery,
  ElysiumUserActivityQuery,
  ElysiumUserBridgeQuery,
} from '../../clients/hypedexer/rest/elysium/elysium-indexer.client';
import { buildHypedexerCacheKey } from '../../clients/hypedexer/rest/shared/hypedexer-cache.helper';
import { cacheService } from '../../core/cache.service';
import { HYPEDEXER_TTL } from '../../constants/hypedexer.cache';

const ELYSIUM_CACHE_DOMAIN = 'elysium';

/**
 * Elysium testnet pass-through. Every cache key includes the query params so a
 * filtered call never shares an entry with the unfiltered one.
 */
export class IndexerElysiumService {
  private static instance: IndexerElysiumService;
  private readonly client = HypeDexerElysiumIndexerClient.getInstance();

  public static getInstance(): IndexerElysiumService {
    if (!IndexerElysiumService.instance) {
      IndexerElysiumService.instance = new IndexerElysiumService();
    }
    return IndexerElysiumService.instance;
  }

  private cached(
    method: string,
    params: object | undefined,
    ttl: number,
    fetcher: () => Promise<unknown>
  ): Promise<unknown> {
    const key = buildHypedexerCacheKey(
      ELYSIUM_CACHE_DOMAIN,
      method,
      params as Record<string, unknown> | undefined
    );
    return cacheService.getOrSet<unknown>(key, fetcher, ttl);
  }

  public getStats(): Promise<unknown> {
    return this.cached('stats', undefined, HYPEDEXER_TTL.elysiumStats, () => this.client.getStats());
  }

  public getStatsDaily(params?: ElysiumStatsDailyQuery): Promise<unknown> {
    return this.cached('stats:daily', params, HYPEDEXER_TTL.elysiumStatsDaily, () =>
      this.client.getStatsDaily(params)
    );
  }

  public getBlocks(params?: ElysiumBlocksQuery): Promise<unknown> {
    return this.cached('blocks', params, HYPEDEXER_TTL.elysiumBlocks, () => this.client.getBlocks(params));
  }

  public getTransactions(params?: ElysiumTransactionsQuery): Promise<unknown> {
    return this.cached('transactions', params, HYPEDEXER_TTL.elysiumTransactions, () =>
      this.client.getTransactions(params)
    );
  }

  public getBatches(params?: ElysiumBatchesQuery): Promise<unknown> {
    return this.cached('batches', params, HYPEDEXER_TTL.elysiumBatches, () => this.client.getBatches(params));
  }

  public getBridgeTransfers(params?: ElysiumBridgeTransfersQuery): Promise<unknown> {
    return this.cached('bridge:transfers', params, HYPEDEXER_TTL.elysiumBridgeTransfers, () =>
      this.client.getBridgeTransfers(params)
    );
  }

  public getBridgeRetryables(params?: ElysiumBridgeRetryablesQuery): Promise<unknown> {
    return this.cached('bridge:retryables', params, HYPEDEXER_TTL.elysiumBridgeRetryables, () =>
      this.client.getBridgeRetryables(params)
    );
  }

  public getBridgeReserves(params: ElysiumBridgeReservesQuery): Promise<unknown> {
    return this.cached('bridge:reserves', params, HYPEDEXER_TTL.elysiumBridgeReserves, () =>
      this.client.getBridgeReserves(params)
    );
  }

  public getBridgeTokens(params?: ElysiumBridgeTokensQuery): Promise<unknown> {
    return this.cached('bridge:tokens', params, HYPEDEXER_TTL.elysiumBridgeTokens, () =>
      this.client.getBridgeTokens(params)
    );
  }

  public getTokens(params?: ElysiumTokensQuery): Promise<unknown> {
    return this.cached('tokens', params, HYPEDEXER_TTL.elysiumTokens, () => this.client.getTokens(params));
  }

  /** Addresses are lower-cased so checksum variants share one cache entry. */
  public getUserBalances(address: string): Promise<unknown> {
    const a = address.toLowerCase();
    return this.cached('user:balances', { address: a }, HYPEDEXER_TTL.elysiumUser, () =>
      this.client.getUserBalances(a)
    );
  }

  public getUserActivity(address: string, params?: ElysiumUserActivityQuery): Promise<unknown> {
    const a = address.toLowerCase();
    return this.cached('user:activity', { address: a, ...params }, HYPEDEXER_TTL.elysiumUser, () =>
      this.client.getUserActivity(a, params)
    );
  }

  public getUserBridge(address: string, params?: ElysiumUserBridgeQuery): Promise<unknown> {
    const a = address.toLowerCase();
    return this.cached('user:bridge', { address: a, ...params }, HYPEDEXER_TTL.elysiumUser, () =>
      this.client.getUserBridge(a, params)
    );
  }
}
