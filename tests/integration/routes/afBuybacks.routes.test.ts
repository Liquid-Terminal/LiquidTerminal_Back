/**
 * GET /market/revenue/af-buybacks — the status of each service outcome. The
 * service is mocked; its own suite covers the reads.
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

jest.mock('../../../src/services/revenue/revenue.service', () => ({
  RevenueService: { getInstance: () => ({ getBreakdown: jest.fn() }) },
}));

const getBuybacks = jest.fn();
jest.mock('../../../src/services/revenue/afBuybacks.service', () => {
  const actual = jest.requireActual('../../../src/services/revenue/afBuybacks.service');
  return {
    ...actual,
    AfBuybacksService: { getInstance: () => ({ getBuybacks }) },
  };
});

import revenueRoutes from '../../../src/routes/revenue/revenue.routes';
import { AfBuybacksUnavailableError } from '../../../src/services/revenue/afBuybacks.service';

function buildApp() {
  const app = express();
  app.use('/market/revenue', revenueRoutes);
  return app;
}

describe('GET /market/revenue/af-buybacks', () => {
  beforeEach(() => {
    getBuybacks.mockReset();
  });

  it('serves the buybacks', async () => {
    const data = {
      days: [{ time: 1_791_331_200_000, hype: 24038.65, usd: 2_150_000, fills: 922 }],
      today: { time: 1_791_417_600_000, hype: 16365.06, usd: 1_400_000, fills: 705 },
      recent: [{ time: 1_791_471_000_000, px: 85.6, sz: 12.5 }],
      windowDays: 13,
      lastUpdate: 1_791_471_060_000,
    };
    getBuybacks.mockResolvedValue(data);

    const res = await request(buildApp()).get('/market/revenue/af-buybacks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data });
  });

  it('answers 503 while the running day cannot be read', async () => {
    getBuybacks.mockRejectedValue(new AfBuybacksUnavailableError());

    const res = await request(buildApp()).get('/market/revenue/af-buybacks');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      success: false,
      error: { message: 'Assistance Fund buybacks temporarily unavailable', code: 'AF_BUYBACKS_UNAVAILABLE' },
    });
  });

  it('answers 500 on anything else, without its message', async () => {
    getBuybacks.mockRejectedValue(new Error('redis exploded at 10.0.0.3'));

    const res = await request(buildApp()).get('/market/revenue/af-buybacks');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      success: false,
      error: { message: 'Internal server error', code: 'INTERNAL_SERVER_ERROR' },
    });
  });
});
