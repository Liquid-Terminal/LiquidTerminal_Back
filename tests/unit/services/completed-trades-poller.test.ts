/**
 * The completed trades poller replaces HypeDexer's dropped `completed_trades`
 * WebSocket channel with GET /completed-trades/. Against a fake HypeDexer that
 * behaves like the real one (a trade is listed 0.3–3.6 s after it closes,
 * `start_time` is truncated to the second, offset pagination), every trade must
 * be delivered exactly once — across overlapping polls, pages, failures and
 * pauses — and never one older than the catch-up window.
 */
import type { CompletedTrade, HypeDexerCompletedTrade } from '../../../src/types/wallet-events.types';

interface ServerTrade {
  endMs: number;
  listedAtMs: number;
  row: Record<string, unknown>;
}

const mockServer = {
  trades: [] as ServerTrade[],
  requests: [] as { atMs: number; startTime: string; offset: number; limit: number }[],
  failures: 0,
  /** Rows appended as-is to the next response (malformed on purpose). */
  junk: [] as unknown[],
  /** While set, responses are computed but held back: the request stays in flight. */
  gate: null as Promise<void> | null,
  handle(path: string): unknown[] {
    const url = new URL(path, 'https://api.hypedexer.test');
    const params = url.searchParams;
    const startTime = params.get('start_time') ?? '';
    const offset = Number(params.get('offset') ?? 0);
    const limit = Number(params.get('limit') ?? 100);
    this.requests.push({ atMs: Date.now(), startTime, offset, limit });
    if (this.failures > 0) {
      this.failures -= 1;
      throw new Error('HTTP 502: Bad Gateway');
    }
    expect(url.pathname).toBe('/completed-trades/');
    expect(params.get('sort_by')).toBe('end_time');
    expect(params.get('sort_dir')).toBe('ASC');
    // HypeDexer compares end_time with start_time truncated to the second.
    const fromMs = Math.floor(Date.parse(startTime) / 1000) * 1000;
    const listed = this.trades
      .filter((t) => t.listedAtMs <= Date.now() && t.endMs >= fromMs)
      .sort((a, b) => a.endMs - b.endMs)
      .map((t) => t.row);
    const page = listed.slice(offset, offset + limit);
    if (this.junk.length > 0) {
      page.push(...this.junk);
      this.junk = [];
    }
    return page;
  },
};

jest.mock('../../../src/utils/logDeduplicator', () => ({
  logDeduplicator: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../src/clients/hypedexer/rest/shared/hypedexer-base.client', () => ({
  HypeDexerBaseClient: class {
    protected async getSingleAttemptUnwrapped<T>(endpoint: string): Promise<T> {
      const rows = mockServer.handle(endpoint);
      if (mockServer.gate) await mockServer.gate;
      return rows as T;
    }
  },
}));

const T0 = Date.UTC(2026, 8, 24, 21, 0, 0); // a whole second, like the poller's first `since`
const OVERLAP_MS = 10_000;

/** HypeDexer's format: ISO without zone designator, microseconds. */
function naiveIso(ms: number): string {
  return new Date(ms).toISOString().replace('Z', '000');
}

let seq = 0;
function row(endMs: number, overrides: Partial<HypeDexerCompletedTrade> = {}): Record<string, unknown> {
  seq += 1;
  return {
    user: '0xAbC0000000000000000000000000000000000001',
    coin: 'BTC',
    direction: 'long',
    start_time: naiveIso(endMs - 60_000),
    end_time: naiveIso(endMs),
    duration_s: 60,
    entry_price: 100,
    exit_price: 101,
    size_close: 2,
    pnl_realized: 2,
    leverage_type: 'cross',
    position_value: 200,
    total_fills: 2,
    total_fees: 0.1,
    avg_fill_price: 100.5,
    first_fill_time: naiveIso(endMs - 60_000),
    last_fill_time: naiveIso(endMs),
    total_volume: 402,
    trade_id: `trade_BTC_${seq}`,
    close_hash: `0xh${seq}`,
    created_at: naiveIso(endMs + 500),
    ...overrides,
  };
}

function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/** One trade closing every `everyMs` in [fromMs, toMs), listed 0.3–3.6 s later. */
function addTrades(fromMs: number, toMs: number, everyMs: number, rnd: () => number): ServerTrade[] {
  const added: ServerTrade[] = [];
  for (let endMs = fromMs; endMs < toMs; endMs += everyMs) {
    const trade = { endMs, listedAtMs: endMs + 300 + Math.floor(rnd() * 3_300), row: row(endMs) };
    mockServer.trades.push(trade);
    added.push(trade);
  }
  return added;
}

const idsOf = (trades: ServerTrade[]): string[] => trades.map((t) => String(t.row.trade_id)).sort();

describe('HypeDexerCompletedTradesPoller', () => {
  let Poller: typeof import('../../../src/clients/hypedexer/rest/completed-trades/completed-trades-poller.client').HypeDexerCompletedTradesPoller;
  let delivered: CompletedTrade[];
  let poller: InstanceType<typeof Poller>;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers({ now: T0, doNotFake: ['setImmediate', 'nextTick'] });
    mockServer.trades = [];
    mockServer.requests = [];
    mockServer.failures = 0;
    mockServer.junk = [];
    mockServer.gate = null;
    delivered = [];
    Poller = require('../../../src/clients/hypedexer/rest/completed-trades/completed-trades-poller.client')
      .HypeDexerCompletedTradesPoller;
    poller = Poller.getInstance();
    poller.onCompletedTrade((trades) => delivered.push(...trades));
  });

  afterEach(() => {
    poller.stop();
    jest.useRealTimers();
  });

  const deliveredIds = (): string[] => delivered.map((t) => t.tradeId).sort();

  it('delivers every trade once, including those listed after a poll already passed them', async () => {
    const trades = addTrades(T0 - 30_000, T0 + 60_000, 170, rng(1));
    poller.start();
    await jest.advanceTimersByTimeAsync(70_000);

    const expected = trades.filter((t) => t.endMs >= T0 - OVERLAP_MS);
    expect(deliveredIds()).toEqual(idsOf(expected));
    expect(new Set(deliveredIds()).size).toBe(delivered.length);
    // One request per 5 s: the overlap costs payload, not requests.
    expect(mockServer.requests.length).toBe(15);
  });

  it('pages through a window holding more than one page', async () => {
    const trades = addTrades(T0 - 9_000, T0 - 1_000, 6, rng(2)).map((t) => ({ ...t, listedAtMs: T0 - 1 }));
    mockServer.trades = trades;
    expect(trades.length).toBeGreaterThan(1_000);
    poller.start();
    await jest.advanceTimersByTimeAsync(1);

    expect(mockServer.requests.map((r) => r.offset)).toEqual([0, 500, 1_000]);
    expect(deliveredIds()).toEqual(idsOf(trades));
  });

  it('retries from the same point after failures, backing off', async () => {
    const trades = addTrades(T0 - 5_000, T0 + 40_000, 250, rng(3));
    mockServer.failures = 2;
    poller.start();
    await jest.advanceTimersByTimeAsync(45_000);

    const at = mockServer.requests.map((r) => r.atMs - T0);
    expect(at.slice(0, 5)).toEqual([0, 10_000, 30_000, 35_000, 40_000]);
    // Nothing that closed during the failures is lost.
    expect(deliveredIds()).toEqual(idsOf(trades.filter((t) => t.listedAtMs <= T0 + 45_000)));
  });

  it('after a long outage, alerts only on trades inside the catch-up window', async () => {
    const trades = addTrades(T0, T0 + 8 * 60_000, 1_000, rng(4));
    mockServer.failures = 9; // 0, 10, 30, 70, 130, 190, 250, 310, 370 s — back at 430 s
    poller.start();
    await jest.advanceTimersByTimeAsync(431_000);

    const recoveredAt = T0 + 430_000;
    expect(mockServer.requests.at(-1)?.atMs).toBe(recoveredAt);
    const floor = Math.floor((recoveredAt - 5 * 60_000 - OVERLAP_MS) / 1_000) * 1_000;
    expect(deliveredIds()).toEqual(idsOf(trades.filter((t) => t.endMs >= floor && t.listedAtMs <= recoveredAt)));
  });

  it('requests nothing while paused and does not replay the paused window', async () => {
    const trades = addTrades(T0, T0 + 120_000, 500, rng(5));
    poller.start();
    await jest.advanceTimersByTimeAsync(10_000);
    const requestsBeforePause = mockServer.requests.length;

    poller.setPaused(true);
    await jest.advanceTimersByTimeAsync(60_000);
    expect(mockServer.requests.length).toBe(requestsBeforePause);

    const resumedAt = Date.now();
    poller.setPaused(false);
    await jest.advanceTimersByTimeAsync(60_000);

    const beforePause = trades.filter((t) => t.listedAtMs <= T0 + 10_000);
    const sinceResume = trades.filter((t) => t.endMs >= resumedAt - OVERLAP_MS && t.listedAtMs <= resumedAt + 60_000);
    expect(deliveredIds()).toEqual(idsOf([...beforePause, ...sinceResume]));
  });

  it('skips malformed rows and normalizes the others', async () => {
    mockServer.trades.push({
      endMs: T0 - 2_000,
      listedAtMs: T0 - 1_000,
      row: row(T0 - 2_000, { trade_id: 'trade_ETH_ok', coin: 'ETH', direction: 'short', pnl_realized: -5 }),
    });
    mockServer.junk = [null, 'x', { ...row(T0), trade_id: undefined }, { ...row(T0), end_time: 'not a date' }];
    poller.start();
    await jest.advanceTimersByTimeAsync(1);

    expect(delivered).toEqual([
      {
        tradeId: 'trade_ETH_ok',
        user: '0xabc0000000000000000000000000000000000001',
        coin: 'ETH',
        direction: 'short',
        pnlRealized: -5,
        pnlPercentage: -2.5,
        positionValue: 200,
        entryPrice: 100,
        exitPrice: 101,
        totalFees: 0.1,
        totalVolume: 402,
        durationSeconds: 60,
        endTime: naiveIso(T0 - 2_000),
        closeHash: expect.stringMatching(/^0xh/),
      },
    ]);
  });

  it('stops polling on stop() and polls again once restarted', async () => {
    addTrades(T0 - 5_000, T0, 500, rng(6));
    poller.start();
    await jest.advanceTimersByTimeAsync(1);
    poller.stop();
    await jest.advanceTimersByTimeAsync(30_000);
    expect(mockServer.requests.length).toBe(1);

    poller.onCompletedTrade((trades) => delivered.push(...trades));
    poller.start();
    await jest.advanceTimersByTimeAsync(1);
    expect(mockServer.requests.length).toBe(2);
  });

  it('keeps one loop and drops the stale rows when restarted during a request', async () => {
    const trades = addTrades(T0 - 5_000, T0 + 30_000, 500, rng(7));
    let release!: () => void;
    mockServer.gate = new Promise<void>((resolve) => { release = resolve; });
    poller.start();
    await jest.advanceTimersByTimeAsync(1); // request #1 in flight
    poller.stop();
    poller.onCompletedTrade((trades) => delivered.push(...trades));
    poller.start();
    await jest.advanceTimersByTimeAsync(1); // request #2 in flight
    mockServer.gate = null;
    release();
    await jest.advanceTimersByTimeAsync(20_000);

    // Both requests answer at T0+2; the next poll comes 5 s after that. A second
    // loop would add requests 5 s after T0+2 as well, next to the new ones.
    expect(mockServer.requests.map((r) => r.atMs - T0)).toEqual([0, 1, 5_002, 10_002, 15_002, 20_002]);
    expect(new Set(deliveredIds()).size).toBe(delivered.length);
    expect(deliveredIds()).toEqual(idsOf(trades.filter((t) => t.listedAtMs <= T0 + 20_002)));
  });

  it('discards a request that was in flight when the feed was resumed', async () => {
    const trades = addTrades(T0 - 5_000, T0 + 60_000, 500, rng(8));
    poller.start();
    await jest.advanceTimersByTimeAsync(1); // poll at T0
    poller.setPaused(true);
    await jest.advanceTimersByTimeAsync(30_000); // nothing polled until T0+30_001

    let release!: () => void;
    mockServer.gate = new Promise<void>((resolve) => { release = resolve; });
    poller.setPaused(false); // cursor → T0+30_001
    await jest.advanceTimersByTimeAsync(5_000); // poll at T0+35_000 in flight, reading from T0+20 s
    poller.setPaused(true);
    poller.setPaused(false); // cursor → T0+35_001: that request is now stale
    mockServer.gate = null;
    release();
    await jest.advanceTimersByTimeAsync(10_000); // polls at T0+40_001 and T0+45_001, reading from T0+25 s

    // The stale request would have added the trades that closed in [T0+20 s, T0+25 s).
    const expected = trades.filter(
      (t) =>
        (t.endMs >= T0 - OVERLAP_MS && t.listedAtMs <= T0) ||
        (t.endMs >= T0 + 25_000 && t.listedAtMs <= T0 + 45_001)
    );
    expect(deliveredIds()).toEqual(idsOf(expected));
  });
});
