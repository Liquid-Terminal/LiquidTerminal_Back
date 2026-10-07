/**
 * cacheService.getOrSet: concurrent misses on one key share a single fetchFn
 * in this process. Followers get a copy of what was stored (what reading the
 * cache would give them), never the leader's object.
 */
const mockRedis = {
  store: new Map<string, string>(),
  locks: new Set<string>(),
  foreignLock: false,
  healthy: true,
  isHealthy: jest.fn(() => mockRedis.healthy),
  get: jest.fn(async (key: string) => mockRedis.store.get(key) ?? null),
  set: jest.fn(async (key: string, value: string) => {
    mockRedis.store.set(key, value);
  }),
  delete: jest.fn(async (key: string) => {
    mockRedis.locks.delete(key);
  }),
  getClient: () => ({
    set: async (key: string) => {
      if (mockRedis.foreignLock || mockRedis.locks.has(key)) return null;
      mockRedis.locks.add(key);
      return 'OK';
    },
    exists: async (key: string) => (mockRedis.foreignLock || mockRedis.locks.has(key) ? 1 : 0),
  }),
};

jest.mock('../../../src/core/redis.service', () => ({ redisService: mockRedis }));
jest.mock('../../../src/utils/logDeduplicator', () => ({
  logDeduplicator: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { CacheService } from '../../../src/core/cache.service';

const later = <T>(value: T, ms = 30): Promise<T> => new Promise((resolve) => setTimeout(() => resolve(value), ms));

describe('CacheService.getOrSet', () => {
  let cache: CacheService;

  beforeEach(() => {
    mockRedis.store.clear();
    mockRedis.locks.clear();
    mockRedis.foreignLock = false;
    mockRedis.healthy = true;
    mockRedis.set.mockClear();
    cache = new CacheService();
  });

  it('runs fetchFn once for concurrent misses and hands followers a copy', async () => {
    const fetchFn = jest.fn(() => later({ rows: [1, 2, 3], at: new Date(0) }));
    const results = await Promise.all(Array.from({ length: 10 }, () => cache.getOrSet('k', fetchFn, 60)));

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(mockRedis.set).toHaveBeenCalledTimes(1);
    const [leader, ...followers] = results;
    expect(leader.at).toBeInstanceOf(Date);
    for (const follower of followers) {
      expect(follower).not.toBe(leader);
      // Exactly what a cache hit returns.
      expect(follower).toEqual(JSON.parse(mockRedis.store.get('k') as string));
    }
  });

  it('still runs fetchFn once when it outlasts the 600 ms lock wait', async () => {
    const fetchFn = jest.fn(() => later('slow', 700));
    const results = await Promise.all(Array.from({ length: 6 }, () => cache.getOrSet('k', fetchFn)));
    expect(results).toEqual(Array(6).fill('slow'));
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('serves hits from Redis without calling fetchFn', async () => {
    mockRedis.store.set('k', JSON.stringify({ cached: true }));
    const fetchFn = jest.fn(async () => ({ cached: false }));
    await expect(cache.getOrSet('k', fetchFn)).resolves.toEqual({ cached: true });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('keeps keys independent and recomputes once a miss has settled', async () => {
    const fetchFn = jest.fn(async () => later('v'));
    await Promise.all([cache.getOrSet('a', fetchFn), cache.getOrSet('b', fetchFn)]);
    expect(fetchFn).toHaveBeenCalledTimes(2);

    mockRedis.store.clear();
    await cache.getOrSet('a', fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('falls back to a direct fetch for every caller when the shared one fails', async () => {
    let calls = 0;
    const fetchFn = jest.fn(async () => {
      calls += 1;
      if (calls === 1) {
        await later(null);
        throw new Error('upstream down');
      }
      return 'recovered';
    });
    const results = await Promise.all(Array.from({ length: 4 }, () => cache.getOrSet('k', fetchFn)));
    expect(results).toEqual(['recovered', 'recovered', 'recovered', 'recovered']);
    // 1 shared attempt + 1 retry per caller: what each caller did on its own before.
    expect(fetchFn).toHaveBeenCalledTimes(5);
  });

  it('shares the wait when another instance holds the Redis lock', async () => {
    mockRedis.foreignLock = true;
    // The other instance gives up without caching: waiters stop polling once
    // its lock is gone instead of waiting out the 15 s.
    setTimeout(() => { mockRedis.foreignLock = false; }, 600);
    const fetchFn = jest.fn(async () => 'mine');
    const results = await Promise.all(Array.from({ length: 5 }, () => cache.getOrSet('k', fetchFn)));
    expect(results).toEqual(['mine', 'mine', 'mine', 'mine', 'mine']);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('skips Redis entirely while its circuit is open', async () => {
    mockRedis.healthy = false;
    mockRedis.store.set('k', JSON.stringify('cached'));
    mockRedis.get.mockClear();
    const fetchFn = jest.fn(async () => 'fresh');
    await expect(cache.getOrSet('k', fetchFn)).resolves.toBe('fresh');
    expect(mockRedis.get).not.toHaveBeenCalled();
    expect(mockRedis.set).not.toHaveBeenCalled();
  });

  it('stores a constant TTL as given', async () => {
    await cache.getOrSet('k', async () => [1], 55);
    expect(mockRedis.set).toHaveBeenCalledWith('k', '[1]', 55);
  });

  it('derives the TTL from the fetched value when given a function', async () => {
    const ttl = jest.fn((rows: number[]) => (rows.length === 0 ? 3600 : 60));
    await cache.getOrSet('empty', async () => [] as number[], ttl);
    await cache.getOrSet('busy', async () => [1, 2], ttl);
    expect(ttl).toHaveBeenNthCalledWith(1, []);
    expect(ttl).toHaveBeenNthCalledWith(2, [1, 2]);
    expect(mockRedis.set).toHaveBeenCalledWith('empty', '[]', 3600);
    expect(mockRedis.set).toHaveBeenCalledWith('busy', '[1,2]', 60);
  });

  it('never stores a key without expiry, whatever the TTL function returns', async () => {
    const cases: Array<[string, number, number]> = [
      ['zero', 0, 1],
      ['negative', -5, 1],
      ['fraction', 2.2, 3],
      ['nan', Number.NaN, 300],
    ];
    for (const [key, returned, stored] of cases) {
      await cache.getOrSet(key, async () => 'v', () => returned);
      expect(mockRedis.set).toHaveBeenCalledWith(key, '"v"', stored);
    }
  });

  it('keeps the fetched value and the default TTL when the TTL function throws', async () => {
    const fetchFn = jest.fn(async () => 'paid for');
    const result = await cache.getOrSet('k', fetchFn, () => {
      throw new Error('bad ttl');
    });
    expect(result).toBe('paid for');
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(mockRedis.set).toHaveBeenCalledWith('k', '"paid for"', 300);
  });
});
