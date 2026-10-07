/**
 * HYPE stakers come from Hypurrscan's /holders/stakedHYPE, downloaded only
 * while someone reads them (no poller) and sorted once per download:
 * - pages, top holders, stats and address lookups keep their former output;
 * - concurrent readers share one download, a list is reused for 3 minutes
 *   then served stale while one refresh runs;
 * - an empty upstream list is never served as "nobody stakes".
 */
jest.mock('../../../src/utils/logDeduplicator', () => ({
  logDeduplicator: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const payload = (holders: Record<string, number>, lastUpdate = 1_791_297_085): unknown => ({
  token: 'stakedHYPE',
  lastUpdate,
  holders,
  holdersCount: Object.keys(holders).length,
});

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

const HOLDERS = {
  '0xaaa': 5,
  '0xbbb': 250_000,
  '0xccc': 5,
  '0xddd': 12,
  '0xeee': 0.5,
  '0xfff': 1_200,
};

describe('StakedHoldersService', () => {
  const realFetch = global.fetch;
  let fetchMock: jest.Mock;
  let now: number;
  let StakedHoldersService: typeof import('../../../src/services/staking/stakedHolders.service').StakedHoldersService;

  beforeEach(() => {
    jest.resetModules();
    now = 1_800_000_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    fetchMock = jest.fn(async () => json(payload(HOLDERS)));
    global.fetch = fetchMock as unknown as typeof fetch;
    StakedHoldersService = require('../../../src/services/staking/stakedHolders.service').StakedHoldersService;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    global.fetch = realFetch;
  });

  it('reads /holders/stakedHYPE and pages it largest stake first, ties in upstream order', async () => {
    const service = StakedHoldersService.getInstance();

    const first = await service.getStakedHolders(1, 4);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/holders\/stakedHYPE$/);
    expect(first.holders).toEqual([
      { address: '0xbbb', amount: 250_000 },
      { address: '0xfff', amount: 1_200 },
      { address: '0xddd', amount: 12 },
      { address: '0xaaa', amount: 5 },
    ]);
    expect(first.pagination).toEqual({
      page: 1, limit: 4, total: 6, totalPages: 2, hasNext: true, hasPrevious: false,
    });
    expect(first.metadata).toEqual({ token: 'stakedHYPE', lastUpdate: 1_791_297_085, holdersCount: 6 });

    const second = await service.getStakedHolders(2, 4);
    expect(second.holders).toEqual([
      { address: '0xccc', amount: 5 },
      { address: '0xeee', amount: 0.5 },
    ]);
    expect(second.pagination).toMatchObject({ page: 2, hasNext: false, hasPrevious: true });
    expect((await service.getStakedHolders(3, 4)).holders).toEqual([]);
    expect(await service.getTopHolders(2)).toEqual(first.holders.slice(0, 2));
  });

  it('rejects the same out-of-range parameters as before', async () => {
    const service = StakedHoldersService.getInstance();
    await expect(service.getStakedHolders(0, 10)).rejects.toThrow('Page must be greater than 0');
    await expect(service.getStakedHolders(1, 0)).rejects.toThrow('Limit must be between 1 and 1000');
    await expect(service.getStakedHolders(1, 1001)).rejects.toThrow('Limit must be between 1 and 1000');
    await expect(service.getTopHolders(101)).rejects.toThrow('Limit must be between 1 and 100');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('looks an address up case-insensitively, own keys only', async () => {
    const service = StakedHoldersService.getInstance();
    await expect(service.getHolderByAddress('0xFFF')).resolves.toEqual({ address: '0xFFF', amount: 1_200 });
    await expect(service.getHolderByAddress('0x123')).resolves.toBeNull();
    await expect(service.getHolderByAddress('constructor')).resolves.toBeNull();
    await expect(service.getHolderByAddress('')).rejects.toThrow('Valid address is required');
  });

  it('computes the stats once per downloaded list', async () => {
    const service = StakedHoldersService.getInstance();
    const stats = await service.getHoldersStats();
    const total = 250_000 + 1_200 + 12 + 5 + 5 + 0.5;

    expect(stats.totalHolders).toBe(6);
    expect(stats.totalStaked).toBe(total);
    expect(stats.averageStaked).toBe(total / 6);
    expect(stats.lastUpdate).toBe(1_791_297_085);
    expect(stats.distributionByRange.map((r) => [r.range, r.holdersCount, r.totalStaked])).toEqual([
      ['0-10', 3, 10.5],
      ['10-50', 1, 12],
      ['50-250', 0, 0],
      ['250-1000', 0, 0],
      ['1000-5000', 1, 1_200],
      ['5000-25000', 0, 0],
      ['25000-100000', 0, 0],
      ['100000+', 1, 250_000],
    ]);
    expect(stats.distributionByRange[7].percentage).toBe(Math.round((250_000 / total) * 100 * 100) / 100);
    expect(stats.topHoldersStats[0]).toEqual({ topCount: 10, totalStaked: total, percentage: 100 });
    expect(await service.getHoldersStats()).toBe(stats);
  });

  it('shares one download between concurrent readers and reuses it for 3 minutes', async () => {
    let release!: () => void;
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((resolve) => { release = () => resolve(json(payload(HOLDERS))); })
    );
    const service = StakedHoldersService.getInstance();
    const calls = [
      service.getStakedHolders(1, 2),
      service.getHolderByAddress('0xaaa'),
      service.getHoldersStats(),
      service.getTopHolders(3),
    ];
    await flush();
    release();
    await Promise.all(calls);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    now += 2 * 60_000;
    await service.getStakedHolders(1, 2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('serves a stale list while one refresh runs, then the refreshed one', async () => {
    const service = StakedHoldersService.getInstance();
    await service.getStakedHolders(1, 1);

    fetchMock.mockImplementation(async () => json(payload({ '0x999': 7 }, 1_791_297_700)));
    now += 3 * 60_000 + 1;
    const stale = await service.getStakedHolders(1, 1);
    expect(stale.holders).toEqual([{ address: '0xbbb', amount: 250_000 }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await flush();
    const fresh = await service.getStakedHolders(1, 1);
    expect(fresh.holders).toEqual([{ address: '0x999', amount: 7 }]);
    expect(fresh.metadata.lastUpdate).toBe(1_791_297_700);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never serves an empty upstream list, and keeps the stale one when a refresh comes back empty', async () => {
    fetchMock.mockImplementationOnce(async () => json(payload({})));
    const service = StakedHoldersService.getInstance();
    await expect(service.getStakedHolders(1, 10)).rejects.toThrow('Staked holders unavailable');

    await service.getStakedHolders(1, 10);
    fetchMock.mockImplementation(async () => json({ token: 'stakedHYPE' }));
    now += 3 * 60_000 + 1;
    await service.getStakedHolders(1, 10);
    await flush();
    const page = await service.getStakedHolders(1, 10);
    expect(page.pagination.total).toBe(6);
  });
});
