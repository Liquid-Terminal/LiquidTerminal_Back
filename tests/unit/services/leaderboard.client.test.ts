/**
 * The HL leaderboard (~40 MB upstream) is fetched on demand and kept in memory:
 * - concurrent callers share one download;
 * - a snapshot is served as-is for a minute, then served stale while one
 *   background refresh runs, and dropped after five minutes;
 * - a failed fetch keeps serving the stale snapshot, or yields null without one.
 */
const payload = (tag: string): unknown => ({
  leaderboardRows: [
    {
      ethAddress: `0x${tag.padStart(40, '0')}`,
      accountValue: '1',
      displayName: tag,
      prize: 0,
      windowPerformances: [['day', { pnl: '1', roi: '0', vlm: '2' }]],
    },
  ],
});

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('HyperliquidLeaderboardClient', () => {
  const realFetch = global.fetch;
  let fetchMock: jest.Mock;
  let now: number;
  let HyperliquidLeaderboardClient: typeof import('../../../src/clients/hyperliquid/leaderboard/leaderboard.client').HyperliquidLeaderboardClient;

  beforeEach(() => {
    jest.resetModules();
    now = 1_800_000_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    HyperliquidLeaderboardClient = require('../../../src/clients/hyperliquid/leaderboard/leaderboard.client').HyperliquidLeaderboardClient;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    global.fetch = realFetch;
  });

  const tagOf = (data: unknown): string =>
    (data as { leaderboardRows: { displayName: string }[] }).leaderboardRows[0].displayName;

  it('shares one upstream download between concurrent callers', async () => {
    let release!: () => void;
    fetchMock.mockImplementation(
      () => new Promise<Response>((resolve) => { release = () => resolve(json(payload('a'))); })
    );
    const client = HyperliquidLeaderboardClient.getInstance();
    const calls = Array.from({ length: 10 }, () => client.getLeaderboardData());
    await flush();
    release();
    const results = await Promise.all(calls);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results.every((data) => data === results[0])).toBe(true);
    expect(client.getLastUpdate()).toBe(now);
  });

  it('serves a fresh snapshot without refetching', async () => {
    fetchMock.mockImplementation(async () => json(payload('a')));
    const client = HyperliquidLeaderboardClient.getInstance();
    await client.getLeaderboardData();
    now += 59_000;
    await client.getLeaderboardData();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('serves a stale snapshot immediately and refreshes it once in the background', async () => {
    fetchMock.mockImplementationOnce(async () => json(payload('a')));
    const client = HyperliquidLeaderboardClient.getInstance();
    await client.getLeaderboardData();

    now += 61_000;
    fetchMock.mockImplementation(async () => json(payload('b')));
    const [first, second] = await Promise.all([client.getLeaderboardData(), client.getLeaderboardData()]);
    expect(tagOf(first)).toBe('a');
    expect(tagOf(second)).toBe('a');
    await flush();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(tagOf(await client.getLeaderboardData())).toBe('b');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('waits for a refetch once the snapshot is older than five minutes', async () => {
    fetchMock.mockImplementationOnce(async () => json(payload('a')));
    const client = HyperliquidLeaderboardClient.getInstance();
    await client.getLeaderboardData();

    now += 5 * 60_000;
    fetchMock.mockImplementation(async () => json(payload('b')));
    expect(tagOf(await client.getLeaderboardData())).toBe('b');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps serving the stale snapshot when a refresh fails', async () => {
    fetchMock.mockImplementationOnce(async () => json(payload('a')));
    const client = HyperliquidLeaderboardClient.getInstance();
    await client.getLeaderboardData();

    now += 2 * 60_000;
    fetchMock.mockImplementation(async () => json({ error: 'nope' }, 404));
    expect(tagOf(await client.getLeaderboardData())).toBe('a');
    await flush();
    await flush();
    expect(tagOf(await client.getLeaderboardData())).toBe('a');
  });

  it('returns null when there is no snapshot and the fetch fails', async () => {
    fetchMock.mockImplementation(async () => json({ error: 'nope' }, 404));
    const client = HyperliquidLeaderboardClient.getInstance();
    await expect(client.getLeaderboardData()).resolves.toBeNull();
    expect(client.getLastUpdate()).toBe(0);
  });

  it('drops the snapshot five minutes after it was fetched', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick', 'Date'] });
    try {
      fetchMock.mockImplementation(async () => json(payload('a')));
      const client = HyperliquidLeaderboardClient.getInstance();
      await client.getLeaderboardData();
      expect(client.getLastUpdate()).toBe(now);
      jest.advanceTimersByTime(5 * 60_000);
      expect(client.getLastUpdate()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
