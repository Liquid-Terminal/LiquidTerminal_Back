/**
 * HIP-4 reads are shared through Redis: market tapes by age of their newest
 * fill, metadata lists once for every enriched endpoint and settlements, and
 * every cache key carries every param sent upstream.
 */
const mockRedis = {
  store: new Map<string, string>(),
  ttls: new Map<string, number | undefined>(),
  get: jest.fn(async (key: string) => mockRedis.store.get(key) ?? null),
  set: jest.fn(async (key: string, value: string, ttl?: number) => {
    mockRedis.store.set(key, value);
    mockRedis.ttls.set(key, ttl);
  }),
  delete: jest.fn(async (key: string) => {
    mockRedis.store.delete(key);
  }),
  getClient: () => ({ set: async () => 'OK' }),
};

jest.mock('../../../src/core/redis.service', () => ({ redisService: mockRedis }));
jest.mock('../../../src/utils/logDeduplicator', () => ({
  logDeduplicator: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockClient = {
  getFills: jest.fn(),
  getMarkets: jest.fn(),
  getQuestions: jest.fn(),
  getSettlements: jest.fn(),
  getOutcomeTokens: jest.fn(),
  getAnalytics: jest.fn(),
};

jest.mock('../../../src/clients/hypedexer/rest/hip4/hip4.client', () => ({
  HypeDexerHip4Client: { getInstance: () => mockClient },
}));

import { IndexerHip4Service } from '../../../src/services/indexer/indexer-hip4.service';
import { HYPEDEXER_TTL } from '../../../src/constants/hypedexer.cache';

const HOUR = 60 * 60 * 1000;
const fill = (coin: string, ageMs: number) => ({ coin, px: 0.5, sz: 2, time_ms: Date.now() - ageMs, fee_usdc: 0 });

function storedTtl(fragment: string): number | undefined {
  const key = [...mockRedis.ttls.keys()].find((k) => k.includes(fragment));
  return key ? mockRedis.ttls.get(key) : undefined;
}

describe('IndexerHip4Service caching', () => {
  let svc: IndexerHip4Service;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    mockRedis.store.clear();
    mockRedis.ttls.clear();
    Object.values(mockClient).forEach((fn) => fn.mockReset());
    (IndexerHip4Service as unknown as { instance?: IndexerHip4Service }).instance = undefined;
    svc = IndexerHip4Service.getInstance();
    // HL allMids (free, not HypeDexer): answer with nothing.
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({ json: async () => ({}) } as Response);
  });

  afterEach(() => fetchSpy.mockRestore());

  it('shares a market tape across visitors and keeps the transformed shape', async () => {
    mockClient.getFills.mockResolvedValue([fill('#1010', 5_000)]);

    const first = (await svc.getFills({ coin: '#1010', limit: 400 })) as Array<Record<string, unknown>>;
    const second = await svc.getFills({ coin: '#1010', limit: 400 });

    expect(mockClient.getFills).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(first[0]).toMatchObject({ coin: '#1010', notional: 1, fee: 0 });
    expect(typeof first[0].time).toBe('string');
  });

  it('keeps a tape by the age of its newest fill', async () => {
    mockClient.getFills.mockImplementation(async ({ coin }: { coin?: string }) => {
      if (coin === '#1') return [fill(coin, 2 * 24 * HOUR), fill(coin, 3 * 24 * HOUR)];
      if (coin === '#2') return [fill(coin, 3 * HOUR)];
      if (coin === '#3') return [];
      return [fill('#4', 30_000), fill('#4', 2 * 24 * HOUR)];
    });

    await svc.getFills({ coin: '#1', limit: 1000 });
    await svc.getFills({ coin: '#2', limit: 1000 });
    await svc.getFills({ coin: '#3', limit: 1000 });
    await svc.getFills({ limit: 50 });

    expect(storedTtl('"coin":"#1"')).toBe(HYPEDEXER_TTL.hip4DormantFills);
    expect(storedTtl('"coin":"#2"')).toBe(HYPEDEXER_TTL.hip4QuietFills);
    expect(storedTtl('"coin":"#3"')).toBe(HYPEDEXER_TTL.hip4QuietFills);
    expect(storedTtl('fills:{"limit":50}')).toBe(HYPEDEXER_TTL.hip4ActiveFills);
  });

  it('does not treat rows without a readable time as dormant', async () => {
    mockClient.getFills.mockResolvedValue([{ coin: '#9', px: 1, sz: 1 }]);
    await svc.getFills({ coin: '#9' });
    expect(storedTtl('"coin":"#9"')).toBe(HYPEDEXER_TTL.hip4QuietFills);
  });

  it('keys a wallet’s fills on every filter', async () => {
    const user = '0x1111111111111111111111111111111111111111';
    mockClient.getFills.mockImplementation(async (p: { coin?: string }) => [fill(p.coin ?? '#0', 1_000)]);

    const all = (await svc.getFills({ user })) as Array<{ coin: string }>;
    const one = (await svc.getFills({ user, coin: '#1010' })) as Array<{ coin: string }>;

    expect(mockClient.getFills).toHaveBeenCalledTimes(2);
    expect(all[0].coin).toBe('#0');
    expect(one[0].coin).toBe('#1010');
  });

  it('reads the metadata lists once for enriched markets, questions and settlements', async () => {
    mockClient.getMarkets.mockResolvedValue([
      { outcome_id: 10, question_id: null, coin: '#10', class: 'priceBinary', underlying: 'BTC', name: 'Recurring', target_price: 1, total_volume: 5 },
    ]);
    mockClient.getOutcomeTokens.mockResolvedValue([{ outcome_id: 10, coin: '#10', spot_name: 'USDC' }]);
    mockClient.getQuestions.mockResolvedValue([{ question_id: 1, name: 'Q', description: null, fallback_outcome: null, named_outcomes: [], settled_named_outcomes: [] }]);
    mockClient.getSettlements.mockResolvedValue([{ outcome_id: 10, settle_fraction: 1, details: 'price:2', block_time: '2026-09-28T06:00:00' }]);

    await svc.getMarketsEnriched();
    await svc.getQuestionsWithOutcomes();
    const settlements = await svc.getSettlements({ limit: 50 });
    await svc.getSettlements({ limit: 50 });

    expect(mockClient.getMarkets).toHaveBeenCalledTimes(1);
    expect(mockClient.getOutcomeTokens).toHaveBeenCalledTimes(1);
    expect(mockClient.getQuestions).toHaveBeenCalledTimes(1);
    expect(mockClient.getSettlements).toHaveBeenCalledTimes(1);
    expect(settlements).toEqual([expect.objectContaining({ outcome_id: 10, winner_side: 0, settled_px: 2 })]);
    expect(storedTtl('hypedexer:hip4:markets')).toBe(HYPEDEXER_TTL.hip4BaseList);
    expect(storedTtl('hypedexer:hip4:settlements')).toBe(HYPEDEXER_TTL.hip4Settlements);
  });

  it('answers markets-enriched per limit instead of whichever limit came first', async () => {
    mockClient.getMarkets.mockImplementation(async ({ limit }: { limit?: number }) =>
      Array.from({ length: limit ?? 100 }, (_, i) => ({ outcome_id: 10 + i, question_id: null, coin: `#${10 + i}`, class: null, underlying: null, name: null }))
    );
    mockClient.getOutcomeTokens.mockResolvedValue([]);
    mockClient.getQuestions.mockResolvedValue([]);

    const big = await svc.getMarketsEnriched({ limit: 500 });
    const small = await svc.getMarketsEnriched();

    expect(big).toHaveLength(500);
    expect(small).toHaveLength(100);
  });

  it('retries an empty metadata list sooner than a populated one', async () => {
    mockClient.getMarkets.mockResolvedValue([]);
    mockClient.getOutcomeTokens.mockResolvedValue([]);
    mockClient.getQuestions.mockResolvedValue([]);

    await svc.getMarketsEnriched();

    expect(storedTtl('hypedexer:hip4:markets')).toBe(HYPEDEXER_TTL.hip4BaseListRetry);
  });
});
