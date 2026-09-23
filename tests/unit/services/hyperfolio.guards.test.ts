/**
 * Upstream-protection guards of the Hyperfolio proxy:
 * - the circuit breaker ignores caller-side failures (bad input, throttles);
 * - no generic retry on 429 / timeouts, one retry on the burst 403 only;
 * - a process-wide budget caps calls per second;
 * - the service never calls upstream twice for one failed miss, caches bad
 *   input, meters misses per IP and only cools down on a real upstream throttle.
 */
const ADDRESS = '0x32309802C8feb2306240893BD79A2E4ba5314e55';

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('HyperfolioClient guards', () => {
  const realFetch = global.fetch;
  let fetchMock: jest.Mock;
  // Fresh module graph per test: the client, its breaker and its throttle are singletons.
  let HyperfolioClient: typeof import('../../../src/clients/hyperfolio/hyperfolio.client').HyperfolioClient;
  let errors: typeof import('../../../src/errors/hyperfolio.errors');

  beforeEach(() => {
    jest.resetModules();
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    HyperfolioClient = require('../../../src/clients/hyperfolio/hyperfolio.client').HyperfolioClient;
    errors = require('../../../src/errors/hyperfolio.errors');
  });

  afterAll(() => {
    global.fetch = realFetch;
  });

  it('does not open the circuit breaker on repeated bad input', async () => {
    fetchMock.mockImplementation(async () => json({ error: 'Could not resolve domain' }));
    const client = HyperfolioClient.getInstance();
    for (let i = 0; i < 6; i += 1) {
      await expect(client.getPoints(`nope${i}.hype`)).rejects.toBeInstanceOf(errors.HyperfolioBadInputError);
    }
    fetchMock.mockImplementation(async () => json({ data: [] }));
    await expect(client.getPoints(ADDRESS)).resolves.toEqual({ data: [] });
    expect(fetchMock).toHaveBeenCalledTimes(7);
  });

  it('does not retry a 429 and maps it to HyperfolioRateLimitedError', async () => {
    fetchMock.mockImplementation(async () => json({ message: 'quota' }, 429));
    const client = HyperfolioClient.getInstance();
    await expect(client.getComposition(ADDRESS)).rejects.toBeInstanceOf(errors.HyperfolioRateLimitedError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry an upstream 500 and hides transport details', async () => {
    fetchMock.mockImplementation(async () => json({ message: 'boom' }, 500));
    const client = HyperfolioClient.getInstance();
    const error = await client.getComposition(ADDRESS).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(errors.HyperfolioUpstreamError);
    expect((error as Error).message).not.toContain('boom');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries the per-second burst 403 exactly once', async () => {
    fetchMock
      .mockImplementationOnce(async () => json({ message: 'Per-second request limit exceeded' }, 403))
      .mockImplementationOnce(async () => json({ data: [] }));
    const client = HyperfolioClient.getInstance();
    await expect(client.getPoints(ADDRESS)).resolves.toEqual({ data: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('caps outbound calls per second across the process', async () => {
    fetchMock.mockImplementation(async () => json({ data: [] }));
    const client = HyperfolioClient.getInstance();
    const calls = Array.from({ length: 12 }, (_, i) =>
      client.getPoints(`0x${String(i).padStart(40, '0')}`)
    );
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(fetchMock).toHaveBeenCalledTimes(8);
    await Promise.all(calls);
    expect(fetchMock).toHaveBeenCalledTimes(12);
  });
});

describe('HyperfolioService guards', () => {
  const clientMock = {
    checkRateLimit: jest.fn(() => true),
    getComposition: jest.fn(),
  };

  let HyperfolioService: typeof import('../../../src/services/hyperfolio/hyperfolio.service').HyperfolioService;
  let errs: typeof import('../../../src/errors/hyperfolio.errors');

  beforeEach(() => {
    jest.resetModules();
    clientMock.checkRateLimit.mockReset().mockReturnValue(true);
    clientMock.getComposition.mockReset();
    jest.doMock('../../../src/core/redis.service', () => ({
      redisService: { get: jest.fn(), set: jest.fn(), delete: jest.fn(), getClient: jest.fn() },
    }));
    jest.doMock('../../../src/clients/hyperfolio/hyperfolio.client', () => ({
      HyperfolioClient: { getInstance: () => clientMock },
    }));
    // Same failure semantics as the real cacheService.getOrSet: a throwing
    // fetchFn is called a second time by its catch-all fallback.
    jest.doMock('../../../src/core/cache.service', () => ({
      cacheService: {
        getOrSet: async <T>(_key: string, fn: () => Promise<T>): Promise<T> => {
          try {
            return await fn();
          } catch {
            return fn();
          }
        },
      },
    }));
    HyperfolioService = require('../../../src/services/hyperfolio/hyperfolio.service').HyperfolioService;
    errs = require('../../../src/errors/hyperfolio.errors');
  });

  it('calls upstream once when a miss fails', async () => {
    clientMock.getComposition.mockRejectedValue(new errs.HyperfolioUpstreamError());
    const service = HyperfolioService.getInstance();
    await expect(service.getComposition(ADDRESS, '1.1.1.1')).rejects.toBeInstanceOf(errs.HyperfolioUpstreamError);
    expect(clientMock.getComposition).toHaveBeenCalledTimes(1);
  });

  it('turns an upstream bad input into a cached marker and a 400', async () => {
    clientMock.getComposition.mockRejectedValue(new errs.HyperfolioBadInputError());
    const service = HyperfolioService.getInstance();
    await expect(service.getComposition('ghost.hype', '1.1.1.1')).rejects.toBeInstanceOf(
      errs.HyperfolioBadInputError
    );
    expect(clientMock.getComposition).toHaveBeenCalledTimes(1);
  });

  it('refuses a miss once the caller spent its per-IP budget, without a global cooldown', async () => {
    clientMock.checkRateLimit.mockReturnValueOnce(false);
    clientMock.getComposition.mockResolvedValue({ data: { tokens: [] } });
    const service = HyperfolioService.getInstance();
    await expect(service.getComposition(ADDRESS, '6.6.6.6')).rejects.toBeInstanceOf(errs.HyperfolioThrottledError);
    expect(clientMock.getComposition).not.toHaveBeenCalled();
    expect(service.isRateLimited()).toBe(false);
    await expect(service.getComposition(ADDRESS, '1.1.1.1')).resolves.toEqual({ data: { tokens: [] } });
  });

  it('opens the shared cooldown on a real upstream throttle', async () => {
    clientMock.getComposition.mockRejectedValue(new errs.HyperfolioRateLimitedError());
    const service = HyperfolioService.getInstance();
    await expect(service.getComposition(ADDRESS, '1.1.1.1')).rejects.toBeInstanceOf(errs.HyperfolioRateLimitedError);
    expect(service.isRateLimited()).toBe(true);
    await expect(service.getComposition(ADDRESS, '2.2.2.2')).rejects.toBeInstanceOf(errs.HyperfolioRateLimitedError);
    expect(clientMock.getComposition).toHaveBeenCalledTimes(1);
  });
});
