/**
 * /liquidations/recent caches upstream answers for 15 s: the key must carry
 * every param that shapes the upstream query, not just hours + limit.
 */
const mockStore = new Map<string, string>();
const mockClient = { getRecentLiquidations: jest.fn() };

jest.mock('../../../src/utils/logDeduplicator', () => ({
  logDeduplicator: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../../src/repositories', () => ({ historicalLiquidationRepository: {} }));
jest.mock('../../../src/core/redis.service', () => ({
  redisService: {
    get: jest.fn(async (key: string) => mockStore.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => {
      mockStore.set(key, value);
    }),
  },
}));
jest.mock('../../../src/clients/hypedexer/rest/liquidations/liquidations.client', () => ({
  HLIndexerLiquidationsClient: { getInstance: () => mockClient },
}));
jest.mock('../../../src/services/liquidations/sse-manager.service', () => ({
  SSEManagerService: { getInstance: () => ({ setDataProvider: () => undefined }) },
}));

import type { LiquidationQueryParams } from '../../../src/types/liquidations.types';

describe('LiquidationsService.getRecentLiquidations cache', () => {
  let service: import('../../../src/services/liquidations/liquidations.service').LiquidationsService;

  beforeEach(() => {
    jest.resetModules();
    mockStore.clear();
    mockClient.getRecentLiquidations.mockReset();
    mockClient.getRecentLiquidations.mockImplementation(async (params: LiquidationQueryParams) => ({
      success: true,
      message: '',
      data: [{ coin: params.coin ?? 'ALL' }],
      total_count: 1,
      execution_time_ms: 0,
      next_cursor: null,
      has_more: false,
    }));
    service = require('../../../src/services/liquidations/liquidations.service').LiquidationsService.getInstance();
  });

  const coinOf = (response: { data: unknown[] }): string => (response.data[0] as { coin: string }).coin;

  it('never serves a filtered request from the unfiltered cache entry, or the reverse', async () => {
    expect(coinOf(await service.getRecentLiquidations({ hours: 2, limit: 100 }))).toBe('ALL');
    expect(coinOf(await service.getRecentLiquidations({ hours: 2, limit: 100, coin: 'BTC' }))).toBe('BTC');
    expect(coinOf(await service.getRecentLiquidations({ hours: 2, limit: 100, coin: 'ETH' }))).toBe('ETH');
    expect(coinOf(await service.getRecentLiquidations({ hours: 2, limit: 100 }))).toBe('ALL');
    expect(mockClient.getRecentLiquidations).toHaveBeenCalledTimes(3);
  });

  it('keys on every upstream param', async () => {
    const variants: LiquidationQueryParams[] = [
      { hours: 2, limit: 100 },
      { limit: 100 },
      { hours: 4, limit: 100 },
      { hours: 2, limit: 1000 },
      { hours: 2, limit: 100, user: '0x0000000000000000000000000000000000000001' },
      { hours: 2, limit: 100, amount_dollars: 10_000 },
      { hours: 2, limit: 100, cursor: '1790000000000:1' },
      { hours: 2, limit: 100, order: 'ASC' },
      { limit: 100, start_time: '2026-09-24T00:00:00Z', end_time: '2026-09-24T01:00:00Z' },
    ];
    for (const params of variants) await service.getRecentLiquidations(params);
    expect(mockClient.getRecentLiquidations).toHaveBeenCalledTimes(variants.length);

    // Same params again: all served from cache.
    for (const params of variants) await service.getRecentLiquidations(params);
    expect(mockClient.getRecentLiquidations).toHaveBeenCalledTimes(variants.length);
  });
});
