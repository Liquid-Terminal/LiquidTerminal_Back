/**
 * Hyperliquid's fee rank among every protocol on DefiLlama, computed by the
 * backend instead of each browser downloading the whole fee overview:
 * - the name-matched row with the most 24h fees carries the venue (perps over
 *   the HLP vault line), ranked against the whole field, ties sharing the
 *   lower rank, rows without a 24h figure never counted above it;
 * - the overview is read with its charts excluded and the rank cached.
 */
jest.mock('../../../src/utils/logDeduplicator', () => ({
  logDeduplicator: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const getOrSet = jest.fn(async (_key: string, fetchFn: () => Promise<unknown>, _ttl: number) => fetchFn());
jest.mock('../../../src/core/cache.service', () => ({
  cacheService: {
    getOrSet: (key: string, fetchFn: () => Promise<unknown>, ttl: number) => getOrSet(key, fetchFn, ttl),
  },
}));

import { rankHyperliquidFees } from '../../../src/services/defillama/feeRank';
import type { DefiLlamaChainOverview } from '../../../src/types/defillama.types';

const row = (name: string, total24h: unknown): DefiLlamaChainOverview['protocols'][number] =>
  ({ name, total24h, category: null }) as DefiLlamaChainOverview['protocols'][number];

const overview = (protocols: unknown[]): DefiLlamaChainOverview =>
  ({ total24h: null, protocols }) as DefiLlamaChainOverview;

describe('rankHyperliquidFees', () => {
  it('ranks the largest Hyperliquid row against the whole field', () => {
    expect(
      rankHyperliquidFees(
        overview([
          row('Tether', 18_000_000),
          row('Hyperliquid HLP', 22_496),
          row('Circle', 7_500_000),
          row('Hyperliquid Perps', 3_428_042),
          row('Hyperliquid Spot Orderbook', 81_217),
          row('Uniswap', 1_900_000),
          row('Kinto Hyperliquid', null),
          row('Aave', 2_400_000),
        ])
      )
    ).toEqual({ rank: 3, protocolCount: 8, hlFees24h: 3_428_042, name: 'Hyperliquid Perps' });
  });

  it('lets ties share the lower rank', () => {
    expect(
      rankHyperliquidFees(overview([row('A', 10), row('Hyperliquid Perps', 5), row('B', 5), row('C', 1)]))
    ).toMatchObject({ rank: 2, protocolCount: 4 });
  });

  it('never counts a row without a 24h figure above Hyperliquid', () => {
    expect(
      rankHyperliquidFees(
        overview([row('A', null), row('B', Number.NaN), row('C', '9999999'), row('D', Infinity), row('Hyperliquid Perps', 5)])
      )
    ).toMatchObject({ rank: 1, protocolCount: 5 });
  });

  it('is null without a Hyperliquid row carrying 24h fees', () => {
    expect(rankHyperliquidFees(overview([row('Tether', 18), row('Kinto Hyperliquid', null)]))).toBeNull();
    expect(rankHyperliquidFees(overview([]))).toBeNull();
    expect(rankHyperliquidFees(null)).toBeNull();
    expect(rankHyperliquidFees({ total24h: null } as unknown as DefiLlamaChainOverview)).toBeNull();
  });

  it('skips malformed rows', () => {
    expect(
      rankHyperliquidFees(overview([null, { total24h: 50 }, row('Hyperliquid Perps', 5), { name: 7, total24h: 9 }]))
    ).toEqual({ rank: 3, protocolCount: 4, hlFees24h: 5, name: 'Hyperliquid Perps' });
  });
});

describe('DefiLlamaService.getHyperliquidFeeRank', () => {
  const realFetch = global.fetch;

  afterAll(() => {
    global.fetch = realFetch;
  });

  it('reads the overview without its charts and caches the rank for 10 minutes', async () => {
    const fetchMock = jest.fn(async () =>
      new Response(JSON.stringify(overview([row('Tether', 18), row('Hyperliquid Perps', 5), row('Aave', 2)])), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const { DefiLlamaService } = require('../../../src/services/defillama/defillama.service');

    const rank = await DefiLlamaService.getInstance().getHyperliquidFeeRank();

    expect(rank).toEqual({ rank: 2, protocolCount: 3, hlFees24h: 5, name: 'Hyperliquid Perps' });
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe(
      'https://api.llama.fi/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true'
    );
    expect(getOrSet).toHaveBeenCalledWith('defillama:hl:fee-rank', expect.any(Function), 600);
  });
});
