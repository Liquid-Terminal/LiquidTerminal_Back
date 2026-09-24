/**
 * RedisJsonSnapshot keeps the parsed value of a poller-owned key: one GET +
 * parse per update (announced on a pub/sub channel) instead of one per read.
 */
const mockRedis = {
  store: new Map<string, string>(),
  listeners: new Map<string, (message: string) => void>(),
  get: jest.fn(async (key: string) => mockRedis.store.get(key) ?? null),
  subscribe: jest.fn(async (channel: string, cb: (message: string) => void) => {
    mockRedis.listeners.set(channel, cb);
  }),
};

jest.mock('../../../src/core/redis.service', () => ({ redisService: mockRedis }));

import { RedisJsonSnapshot } from '../../../src/core/redisSnapshot';

const publish = (channel: string): void => mockRedis.listeners.get(channel)?.('{"type":"DATA_UPDATED"}');

describe('RedisJsonSnapshot', () => {
  let now: number;

  beforeEach(() => {
    mockRedis.store.clear();
    mockRedis.listeners.clear();
    mockRedis.get.mockClear();
    now = 1_800_000_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('parses once and serves the same value until the poller announces an update', async () => {
    mockRedis.store.set('k', JSON.stringify([{ v: 1 }]));
    const snapshot = new RedisJsonSnapshot<{ v: number }[]>('k', 'k:updated', 15_000);

    const first = await snapshot.get();
    const second = await snapshot.get();
    expect(first).toEqual([{ v: 1 }]);
    expect(second).toBe(first);
    expect(mockRedis.get).toHaveBeenCalledTimes(1);

    mockRedis.store.set('k', JSON.stringify([{ v: 2 }]));
    publish('k:updated');
    expect(await snapshot.get()).toEqual([{ v: 2 }]);
    expect(mockRedis.get).toHaveBeenCalledTimes(2);
  });

  it('reloads after maxAge even without a notification', async () => {
    mockRedis.store.set('k', '1');
    const snapshot = new RedisJsonSnapshot<number>('k', 'k:updated', 15_000);
    await snapshot.get();
    now += 14_999;
    await snapshot.get();
    expect(mockRedis.get).toHaveBeenCalledTimes(1);
    now += 1;
    mockRedis.store.set('k', '2');
    expect(await snapshot.get()).toBe(2);
    expect(mockRedis.get).toHaveBeenCalledTimes(2);
  });

  it('returns null for a missing key without caching it', async () => {
    const snapshot = new RedisJsonSnapshot<number>('k', 'k:updated', 15_000);
    expect(await snapshot.get()).toBeNull();
    mockRedis.store.set('k', '3');
    expect(await snapshot.get()).toBe(3);
  });

  it('shares one GET between concurrent misses', async () => {
    mockRedis.store.set('k', '4');
    const snapshot = new RedisJsonSnapshot<number>('k', 'k:updated', 15_000);
    await expect(Promise.all([snapshot.get(), snapshot.get(), snapshot.get()])).resolves.toEqual([4, 4, 4]);
    expect(mockRedis.get).toHaveBeenCalledTimes(1);
  });

  it('does not keep a value read while an update was being announced', async () => {
    mockRedis.store.set('k', '"old"');
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    mockRedis.get.mockImplementationOnce(async (key: string) => {
      const value = mockRedis.store.get(key) ?? null;
      await gate;
      return value;
    });
    const snapshot = new RedisJsonSnapshot<string>('k', 'k:updated', 15_000);

    const inFlight = snapshot.get();
    mockRedis.store.set('k', '"new"');
    publish('k:updated');
    // A caller arriving after the notification does not join the stale read.
    const after = snapshot.get();
    release();

    expect(await inFlight).toBe('old');
    expect(await after).toBe('new');
    expect(await snapshot.get()).toBe('new');
    expect(mockRedis.get).toHaveBeenCalledTimes(2);
  });
});
