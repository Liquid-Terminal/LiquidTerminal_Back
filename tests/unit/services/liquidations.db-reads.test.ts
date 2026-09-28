/**
 * The dashboard's notable liquidations come from the historical DB (no
 * HypeDexer call), and a wallet's liquidation history is kept 5 min instead of
 * going upstream on every poll.
 */
const mockStore = new Map<string, string>();
const mockTtls = new Map<string, number | undefined>();
const mockClient = { getLiquidations: jest.fn(), getRecentLiquidations: jest.fn() };
const mockRepo = { getTopEvents: jest.fn() };

jest.mock('../../../src/utils/logDeduplicator', () => ({
  logDeduplicator: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../../src/repositories', () => ({ historicalLiquidationRepository: mockRepo }));
jest.mock('../../../src/core/redis.service', () => ({
  redisService: {
    get: jest.fn(async (key: string) => mockStore.get(key) ?? null),
    set: jest.fn(async (key: string, value: string, ttl?: number) => {
      mockStore.set(key, value);
      mockTtls.set(key, ttl);
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

const envelope = (tag: string) => ({
  success: true,
  message: '',
  data: [{ tag }],
  total_count: 1,
  execution_time_ms: 0,
  next_cursor: null,
  has_more: false,
});

describe('LiquidationsService DB reads and history cache', () => {
  let service: import('../../../src/services/liquidations/liquidations.service').LiquidationsService;

  beforeEach(() => {
    jest.resetModules();
    mockStore.clear();
    mockTtls.clear();
    mockClient.getLiquidations.mockReset();
    mockRepo.getTopEvents.mockReset();
    mockClient.getLiquidations.mockImplementation(async (p: LiquidationQueryParams) =>
      envelope(`${p.user ?? 'all'}:${p.limit}`)
    );
    service = require('../../../src/services/liquidations/liquidations.service').LiquidationsService.getInstance();
  });

  it('reads the top liquidations from the DB and shares them for 30 s', async () => {
    const row = { tid: 1, coin: 'BTC', notional_total: 2e6 };
    mockRepo.getTopEvents.mockResolvedValue([row]);

    const before = Date.now();
    const first = await service.getTopLiquidations('24h', 100000, 3);
    const second = await service.getTopLiquidations('24h', 100000, 3);

    expect(first.data).toEqual([row]);
    expect(second).toEqual(first);
    expect(mockRepo.getTopEvents).toHaveBeenCalledTimes(1);
    const [since, min, limit] = mockRepo.getTopEvents.mock.calls[0];
    expect(min).toBe(100000);
    expect(limit).toBe(3);
    // 24h window.
    expect(Math.abs(before - 24 * 3600e3 - (since as Date).getTime())).toBeLessThan(5000);
    expect(mockTtls.get('liquidations:top:24h:100000:3')).toBe(30);
    expect(mockClient.getLiquidations).not.toHaveBeenCalled();
    expect(mockClient.getRecentLiquidations).not.toHaveBeenCalled();
  });

  it('keeps a wallet history 5 min and other lists 15 s, keyed on every param', async () => {
    const user = '0x1111111111111111111111111111111111111111';
    const a = await service.getLiquidations({ user, limit: 100, order: 'DESC' });
    await service.getLiquidations({ user, limit: 100, order: 'DESC' });
    const b = await service.getLiquidations({ user, limit: 50, order: 'DESC' });
    await service.getLiquidations({ coin: 'BTC', limit: 100 });

    expect(a.data).toEqual([{ tag: `${user}:100` }]);
    expect(b.data).toEqual([{ tag: `${user}:50` }]);
    expect(mockClient.getLiquidations).toHaveBeenCalledTimes(3);
    const ttls = [...mockTtls.entries()];
    expect(ttls.filter(([k]) => k.includes(user)).every(([, ttl]) => ttl === 300)).toBe(true);
    expect(ttls.find(([k]) => k.includes('"coin":"BTC"'))?.[1]).toBe(15);
  });
});
