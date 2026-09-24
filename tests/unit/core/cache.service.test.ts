/**
 * cacheService.getOrSet: concurrent misses on one key share a single fetchFn
 * in this process. Followers get a copy of what was stored (what reading the
 * cache would give them), never the leader's object.
 */
const mockRedis = {
  store: new Map<string, string>(),
  locks: new Set<string>(),
  foreignLock: false,
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
    const fetchFn = jest.fn(async () => 'mine');
    const results = await Promise.all(Array.from({ length: 5 }, () => cache.getOrSet('k', fetchFn)));
    expect(results).toEqual(['mine', 'mine', 'mine', 'mine', 'mine']);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
