/**
 * `/liquidations/data` and `/liquidations/stats/all` on a cache miss: one
 * multi-window statement per shape instead of per-window queries, and
 * concurrent misses share that single recomputation.
 */
const mockRepo = {
  getStatsForPeriods: jest.fn(),
  getChartForPeriods: jest.fn(),
  getStats: jest.fn(),
  getChart: jest.fn(),
};
const mockRedis = { get: jest.fn(), set: jest.fn() };

jest.mock('../../../src/utils/logDeduplicator', () => ({
  logDeduplicator: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../../src/repositories', () => ({ historicalLiquidationRepository: mockRepo }));
jest.mock('../../../src/core/redis.service', () => ({ redisService: mockRedis }));
jest.mock('../../../src/clients/hypedexer/rest/liquidations/liquidations.client', () => ({
  HLIndexerLiquidationsClient: { getInstance: () => ({}) },
}));
jest.mock('../../../src/services/liquidations/sse-manager.service', () => ({
  SSEManagerService: { getInstance: () => ({ setDataProvider: () => undefined }) },
}));

import type { HistoricalStats } from '../../../src/types/historical.types';

const stats = (count: number): HistoricalStats => ({
  totalVolume_USD: count * 10,
  liquidationsCount: count,
  longCount: count,
  shortCount: 0,
  longVolume_USD: count * 10,
  shortVolume_USD: 0,
  topCoin: 'BTC',
  topCoinVolume_USD: count * 10,
  avgSize_USD: 10,
  maxLiq_USD: 10,
});

describe('LiquidationsService multi-window data', () => {
  let service: import('../../../src/services/liquidations/liquidations.service').LiquidationsService;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue(undefined);
    mockRepo.getStatsForPeriods.mockImplementation(async (windows: { key: string }[]) =>
      new Map(windows.map((w, i) => [w.key, stats(i + 1)])));
    mockRepo.getChartForPeriods.mockImplementation(async (windows: { key: string }[]) =>
      new Map(windows.map((w) => [w.key, []])));
    service = require('../../../src/services/liquidations/liquidations.service').LiquidationsService.getInstance();
  });

  it('computes all five windows with two statements, shared by concurrent misses', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => service.getAllData()));

    expect(mockRepo.getStatsForPeriods).toHaveBeenCalledTimes(1);
    expect(mockRepo.getChartForPeriods).toHaveBeenCalledTimes(1);
    expect(mockRepo.getStats).not.toHaveBeenCalled();
    expect(mockRepo.getChart).not.toHaveBeenCalled();
    expect(mockRedis.set).toHaveBeenCalledTimes(1);

    const [windows] = mockRepo.getChartForPeriods.mock.calls[0];
    expect(windows.map((w: { key: string; bucketSizeMinutes: number }) => [w.key, w.bucketSizeMinutes]))
      .toEqual([['2h', 5], ['4h', 5], ['8h', 15], ['12h', 15], ['24h', 30]]);
    const spans = windows.map((w: { since: Date }) => windows[0].since.getTime() - w.since.getTime());
    expect(spans).toEqual([0, 2, 6, 10, 22].map((h) => h * 3_600_000));

    for (const result of results) expect(result).toBe(results[0]);
    expect(Object.keys(results[0].periods)).toEqual(['2h', '4h', '8h', '12h', '24h']);
    expect(results[0].periods['24h'].stats.liquidationsCount).toBe(5);
    // 24h of 30-minute buckets, zero-filled.
    expect(results[0].periods['24h'].chart.buckets.length).toBeGreaterThanOrEqual(48);

    // Settled: the next miss recomputes.
    await service.getAllData();
    expect(mockRepo.getStatsForPeriods).toHaveBeenCalledTimes(2);
  });

  it('serves the cached payload without touching the database', async () => {
    mockRedis.get.mockResolvedValue(JSON.stringify({ success: true, periods: {}, metadata: {} }));
    await expect(service.getAllData()).resolves.toEqual({ success: true, periods: {}, metadata: {} });
    expect(mockRepo.getStatsForPeriods).not.toHaveBeenCalled();
  });

  it('fails every waiter with an ALL_DATA_ERROR when the statement fails', async () => {
    mockRepo.getStatsForPeriods.mockRejectedValue(new Error('pool timeout'));
    const outcomes = await Promise.allSettled([service.getAllData(), service.getAllData()]);
    for (const outcome of outcomes) {
      expect(outcome.status).toBe('rejected');
      expect((outcome as PromiseRejectedResult).reason).toMatchObject({ code: 'ALL_DATA_ERROR', statusCode: 500 });
    }
    expect(mockRepo.getStatsForPeriods).toHaveBeenCalledTimes(1);
  });

  it('builds /stats/all from one statement and reports a failure per window', async () => {
    const ok = await service.getAllStats();
    expect(mockRepo.getStatsForPeriods).toHaveBeenCalledTimes(1);
    expect(ok.success).toBe(true);
    expect(Object.keys(ok.stats)).toEqual(['2h', '4h', '8h', '12h', '24h']);
    expect(ok.stats['2h']?.liquidationsCount).toBe(1);
    expect(ok.errors).toBeUndefined();

    mockRepo.getStatsForPeriods.mockRejectedValue(new Error('down'));
    const failed = await service.getAllStats();
    expect(failed.success).toBe(false);
    expect(Object.values(failed.stats).every((v) => v === null)).toBe(true);
    expect(failed.errors).toEqual(['2h', '4h', '8h', '12h', '24h'].map((p) => `Failed to calculate ${p} stats`));
  });
});
