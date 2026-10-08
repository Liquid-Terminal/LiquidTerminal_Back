/**
 * GET /defillama/fee-rank — the status of each service outcome. The service
 * is mocked; its own suite covers the ranking.
 */
import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import request from 'supertest';

jest.mock('../../../src/middleware/apiRateLimiter', () => ({
  marketRateLimiter: (_req: Request, _res: Response, next: NextFunction) => {
    next();
  },
}));

jest.mock('../../../src/utils/logDeduplicator', () => ({
  logDeduplicator: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../src/services/defillama/defillama-context.service', () => ({
  DefiLlamaContextService: { getInstance: () => ({}) },
}));

const getHyperliquidFeeRank = jest.fn();
jest.mock('../../../src/services/defillama/defillama.service', () => ({
  DefiLlamaService: { getInstance: () => ({ getHyperliquidFeeRank }) },
}));

import defillamaRoutes from '../../../src/routes/defillama/defillama.routes';
import { DefiLlamaUpstreamError } from '../../../src/errors/defillama.errors';

function buildApp() {
  const app = express();
  app.use('/defillama', defillamaRoutes);
  return app;
}

describe('GET /defillama/fee-rank', () => {
  beforeEach(() => {
    getHyperliquidFeeRank.mockReset();
  });

  it('serves the rank', async () => {
    const data = { rank: 4, protocolCount: 2853, hlFees24h: 3_428_042, name: 'Hyperliquid Perps' };
    getHyperliquidFeeRank.mockResolvedValue(data);
    const res = await request(buildApp()).get('/defillama/fee-rank');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data });
  });

  it('serves null when no Hyperliquid row carries 24h fees', async () => {
    getHyperliquidFeeRank.mockResolvedValue(null);
    const res = await request(buildApp()).get('/defillama/fee-rank');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: null });
  });

  it('answers 502 when DefiLlama fails', async () => {
    getHyperliquidFeeRank.mockRejectedValue(new DefiLlamaUpstreamError());
    const res = await request(buildApp()).get('/defillama/fee-rank');
    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({ success: false, code: 'DEFILLAMA_UPSTREAM_ERROR' });
  });
});
