/**
 * Abuse guards added after the pre-main audit:
 * - inputs that could push upstream into 5xx/timeouts are refused by the schema;
 * - caller-driven failures (odd 4xx, slow-endpoint timeouts) never open the breaker;
 * - a global daily budget hard-stops upstream calls;
 * - IPv6 callers are metered per /64.
 */
import {
  hyperfolioNftsQuerySchema,
  hyperfolioTransactionsQuerySchema,
  hyperfolioYieldQuerySchema,
} from '../../../src/schemas/hyperfolio.schema';
import { rateLimitKeyForIp } from '../../../src/utils/client-ip';

const ADDRESS = '0x32309802C8feb2306240893BD79A2E4ba5314e55';

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const abortError = (): Error => Object.assign(new Error('aborted'), { name: 'AbortError' });

describe('Hyperfolio query validation', () => {
  it('accepts real dates in order', () => {
    expect(
      hyperfolioTransactionsQuerySchema.safeParse({ startDate: '2025-02-28', endDate: '2025-03-01' }).success
    ).toBe(true);
  });

  it.each(['2024-99-99', '2025-02-30', '2025-13-01', '1999-01-01', '2999-01-01'])('rejects %s', (date) => {
    expect(hyperfolioTransactionsQuerySchema.safeParse({ startDate: date }).success).toBe(false);
  });

  it('rejects startDate after endDate', () => {
    expect(
      hyperfolioTransactionsQuerySchema.safeParse({ startDate: '2025-06-02', endDate: '2025-06-01' }).success
    ).toBe(false);
  });

  it('caps deep pages', () => {
    expect(hyperfolioTransactionsQuerySchema.safeParse({ page: '500' }).success).toBe(true);
    expect(hyperfolioTransactionsQuerySchema.safeParse({ page: '501' }).success).toBe(false);
    expect(hyperfolioNftsQuerySchema.safeParse({ page: '201' }).success).toBe(false);
    expect(hyperfolioYieldQuerySchema.safeParse({ page: '101' }).success).toBe(false);
  });
});

describe('rateLimitKeyForIp', () => {
  it.each([
    ['1.2.3.4', '1.2.3.4'],
    ['::ffff:1.2.3.4', '1.2.3.4'],
    ['2001:db8:1:2:aaaa:bbbb:cccc:dddd', '2001:db8:1:2::/64'],
    ['2001:db8:1:2::1', '2001:db8:1:2::/64'],
    ['2001:0DB8:0001:0002:ffff::', '2001:db8:1:2::/64'],
    ['2001:db8::1', '2001:db8:0:0::/64'],
    ['::1', '0:0:0:0::/64'],
    ['fe80::1%eth0', 'fe80:0:0:0::/64'],
    ['unknown', 'unknown'],
  ])('%s → %s', (ip, key) => {
    expect(rateLimitKeyForIp(ip)).toBe(key);
  });
});

describe('HyperfolioClient breaker and daily budget', () => {
  const realFetch = global.fetch;
  const realBudget = process.env.HYPERFOLIO_DAILY_BUDGET;
  let fetchMock: jest.Mock;
  let redisCount: number;
  let redisDown: boolean;
  let HyperfolioClient: typeof import('../../../src/clients/hyperfolio/hyperfolio.client').HyperfolioClient;
  let errors: typeof import('../../../src/errors/hyperfolio.errors');

  function load(budget?: number): void {
    jest.resetModules();
    if (budget) process.env.HYPERFOLIO_DAILY_BUDGET = String(budget);
    else delete process.env.HYPERFOLIO_DAILY_BUDGET;
    jest.doMock('../../../src/core/redis.service', () => ({
      redisService: {
        multi: () => {
          const chain = {
            incr: () => chain,
            expire: () => chain,
            exec: async () => {
              if (redisDown) throw new Error('Stream is not writeable');
              redisCount += 1;
              return [
                [null, redisCount],
                [null, 1],
              ];
            },
          };
          return chain;
        },
      },
    }));
    HyperfolioClient = require('../../../src/clients/hyperfolio/hyperfolio.client').HyperfolioClient;
    errors = require('../../../src/errors/hyperfolio.errors');
  }

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    redisCount = 0;
    redisDown = false;
  });

  afterAll(() => {
    global.fetch = realFetch;
    if (realBudget === undefined) delete process.env.HYPERFOLIO_DAILY_BUDGET;
    else process.env.HYPERFOLIO_DAILY_BUDGET = realBudget;
  });

  it('does not open the breaker on repeated upstream 404s', async () => {
    load();
    fetchMock.mockImplementation(async () => json({ message: 'not found' }, 404));
    const client = HyperfolioClient.getInstance();
    for (let i = 0; i < 6; i += 1) {
      await expect(client.getComposition(`0x${String(i).padStart(40, '0')}`)).rejects.toBeInstanceOf(
        errors.HyperfolioUpstreamError
      );
    }
    fetchMock.mockImplementation(async () => json({ data: [] }));
    await expect(client.getPoints(ADDRESS)).resolves.toEqual({ data: [] });
    expect(fetchMock).toHaveBeenCalledTimes(7);
  });

  it('does not open the breaker on timeouts of slow per-wallet scans', async () => {
    load();
    fetchMock.mockImplementation(async () => {
      throw abortError();
    });
    const client = HyperfolioClient.getInstance();
    for (let i = 0; i < 6; i += 1) {
      await expect(client.getTransactions(`0x${String(i).padStart(40, '0')}`, {})).rejects.toBeInstanceOf(
        errors.HyperfolioUpstreamError
      );
    }
    fetchMock.mockImplementation(async () => json({ data: [] }));
    await expect(client.getPoints(ADDRESS)).resolves.toEqual({ data: [] });
    expect(fetchMock).toHaveBeenCalledTimes(7);
  });

  it('still opens the breaker on timeouts of fast endpoints', async () => {
    load();
    fetchMock.mockImplementation(async () => {
      throw abortError();
    });
    const client = HyperfolioClient.getInstance();
    for (let i = 0; i < 5; i += 1) {
      await expect(client.getComposition(`0x${String(i).padStart(40, '0')}`)).rejects.toBeDefined();
    }
    fetchMock.mockImplementation(async () => json({ data: [] }));
    await expect(client.getPoints(ADDRESS)).rejects.toBeInstanceOf(errors.HyperfolioUpstreamError);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('hard-stops upstream calls once the daily budget is spent, without opening the breaker', async () => {
    load(3);
    fetchMock.mockImplementation(async () => json({ data: [] }));
    const client = HyperfolioClient.getInstance();
    for (let i = 0; i < 3; i += 1) {
      await expect(client.getPoints(`0x${String(i).padStart(40, '0')}`)).resolves.toEqual({ data: [] });
    }
    for (let i = 3; i < 9; i += 1) {
      await expect(client.getPoints(`0x${String(i).padStart(40, '0')}`)).rejects.toBeInstanceOf(
        errors.HyperfolioQuotaExhaustedError
      );
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('falls back to a per-process count when Redis is down', async () => {
    load(2);
    redisDown = true;
    fetchMock.mockImplementation(async () => json({ data: [] }));
    const client = HyperfolioClient.getInstance();
    await client.getPoints(`0x${'1'.padStart(40, '0')}`);
    await client.getPoints(`0x${'2'.padStart(40, '0')}`);
    await expect(client.getPoints(`0x${'3'.padStart(40, '0')}`)).rejects.toBeInstanceOf(
      errors.HyperfolioQuotaExhaustedError
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
