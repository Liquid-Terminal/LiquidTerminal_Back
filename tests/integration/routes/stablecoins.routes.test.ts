/**
 * GET /market/stablecoins/history serves the Hypurrscan `/spotUSDC` series the
 * spot poller caches, entry for entry: the front derives its stablecoin KPIs,
 * charts and holder counts from this array.
 */
import express from 'express';
import request from 'supertest';

const redisGet = jest.fn<Promise<string | null>, [string]>();
jest.mock('../../../src/core/redis.service', () => ({
  redisService: { get: (key: string) => redisGet(key), subscribe: jest.fn() },
}));
jest.mock('../../../src/utils/logDeduplicator', () => ({
  logDeduplicator: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import stablecoinsRoutes from '../../../src/routes/spot/stablecoins.routes';

// Old entries carry USDC only; recent ones every stablecoin.
const SERIES = [
  { lastUpdate: 1719613295, totalSpotUSDC: 10621031.834270295, USDC_holdersCount: 19220, USDC_HIP2: 2428906.22567461 },
  {
    lastUpdate: 1791503462,
    totalSpotUSDC: 2834533180.0425816,
    totalSpotUSDT0: 5381273.123,
    totalSpotUSDE: 5582527.097726468,
    totalSpotUSDH: 5874786.233417442,
    USDC_holdersCount: 1253500,
    USDT0_holdersCount: 11460,
    USDE_holdersCount: 13020,
    USDH_holdersCount: 13870,
    USDC_HIP2: 8262234.99511816,
    USDT0_HIP2: 0,
    USDE_HIP2: 0,
    USDH_HIP2: 0,
  },
  {
    lastUpdate: 1791544880,
    totalSpotUSDC: 2834133870.5211616,
    totalSpotUSDT0: 5375137.748359488,
    totalSpotUSDE: 5582527.097726468,
    totalSpotUSDH: 5874786.233417442,
    USDC_holdersCount: 1253676,
    USDT0_holdersCount: 11467,
    USDE_holdersCount: 13028,
    USDH_holdersCount: 13874,
    USDC_HIP2: 8262234.99511816,
    USDT0_HIP2: 0,
    USDE_HIP2: 0,
    USDH_HIP2: 0,
  },
];

function buildApp() {
  const app = express();
  app.use('/market/stablecoins', stablecoinsRoutes);
  return app;
}

describe('GET /market/stablecoins/history', () => {
  beforeEach(() => redisGet.mockReset());

  it('serves the cached /spotUSDC series as Hypurrscan sent it', async () => {
    redisGet.mockResolvedValue(JSON.stringify(SERIES));
    const res = await request(buildApp()).get('/market/stablecoins/history');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual(SERIES);
    expect(redisGet).toHaveBeenCalledWith('spotUSDC:raw_data');
  });

  it('answers 500 while nothing is cached', async () => {
    redisGet.mockResolvedValue(null);
    const res = await request(buildApp()).get('/market/stablecoins/history');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to fetch stablecoins history');
  });

  it('answers 500 when the cache cannot be read', async () => {
    redisGet.mockRejectedValue(new Error('redis down'));
    const res = await request(buildApp()).get('/market/stablecoins/history');
    expect(res.status).toBe(500);
  });
});
