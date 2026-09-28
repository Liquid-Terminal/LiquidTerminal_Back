import {
  HypeDexerCompletedTradesClient,
  IndexerCompletedTradesQuery,
  IndexerCompletedTradesSummaryQuery,
} from '../../clients/hypedexer/rest/completed-trades/completed-trades.client';
import { buildHypedexerCacheKey } from '../../clients/hypedexer/rest/shared/hypedexer-cache.helper';
import { cacheService } from '../../core/cache.service';
import { HYPEDEXER_TTL } from '../../constants/hypedexer.cache';

/**
 * Lists and summaries are polled every minute (biggest trades, trade explorer,
 * a wallet's round trips) and read the same for every visitor: shared for a
 * minute, keyed on every param.
 */
export class IndexerCompletedTradesService {
  private static instance: IndexerCompletedTradesService;
  private readonly client = HypeDexerCompletedTradesClient.getInstance();

  public static getInstance(): IndexerCompletedTradesService {
    if (!IndexerCompletedTradesService.instance) {
      IndexerCompletedTradesService.instance = new IndexerCompletedTradesService();
    }
    return IndexerCompletedTradesService.instance;
  }

  public async listCompletedTrades(params: IndexerCompletedTradesQuery): Promise<unknown> {
    return cacheService.getOrSet(
      buildHypedexerCacheKey('completed-trades', 'list', { ...params }),
      () => this.client.listCompletedTrades(params),
      HYPEDEXER_TTL.marketList
    );
  }

  public async getSummary(params: IndexerCompletedTradesSummaryQuery): Promise<unknown> {
    return cacheService.getOrSet(
      buildHypedexerCacheKey('completed-trades', 'summary', { ...params }),
      () => this.client.getSummary(params),
      HYPEDEXER_TTL.marketList
    );
  }

  public async getTradeFills(tradeId: string): Promise<unknown> {
    return this.client.getTradeFills(tradeId);
  }
}
