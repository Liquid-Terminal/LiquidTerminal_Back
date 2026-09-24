/**
 * The fill-alert dispatcher consumes two network-wide streams. Once the
 * subscriptions are known it drops, before aggregation or any queue / DB work,
 * every fill nobody can be alerted about — and must never drop one the
 * unfiltered pipeline would have alerted on. The oracle below is the matching
 * logic the dispatcher used before those early exits, applied to every order.
 */
import type { AggregatedFill, NormalizedFill, SpotFill } from '../../../src/types/fill-alerts.types';
import type { ActiveFillSubscription } from '../../../src/services/telegram/telegram.fill-subscription.service';

const mockState = {
  perpListeners: new Set<(fills: NormalizedFill[]) => void>(),
  spotListeners: new Set<(fills: SpotFill[]) => void>(),
  subscriptions: [] as ActiveFillSubscription[],
  loadGate: null as Promise<void> | null,
  broadcasts: [] as string[],
  inserted: new Set<string>(),
};

jest.mock('../../../src/utils/logDeduplicator', () => ({
  logDeduplicator: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../src/core/prisma.telegram.service', () => ({
  prismaTelegram: {
    telegramFillSentAlert: {
      create: jest.fn(async ({ data }: { data: { subscriptionId: string; eventId: string } }) => {
        const key = `${data.subscriptionId}|${data.eventId}`;
        if (mockState.inserted.has(key)) throw Object.assign(new Error('duplicate'), { code: 'P2002' });
        mockState.inserted.add(key);
        return {};
      }),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
  },
}));

jest.mock('../../../src/clients/hypedexer/websocket/live-data.ws.client', () => ({
  HypeDexerLiveDataWSClient: {
    getInstance: () => ({
      onFill: (cb: (fills: NormalizedFill[]) => void) => {
        mockState.perpListeners.add(cb);
        return () => mockState.perpListeners.delete(cb);
      },
      start: () => undefined,
      stop: () => undefined,
    }),
  },
}));

jest.mock('../../../src/clients/hypedexer/websocket/fills-spot.ws.client', () => ({
  HypeDexerSpotFillsWSClient: {
    getInstance: () => ({
      onSpotFill: (cb: (fills: SpotFill[]) => void) => {
        mockState.spotListeners.add(cb);
        return () => mockState.spotListeners.delete(cb);
      },
      start: () => undefined,
      stop: () => undefined,
    }),
  },
}));

jest.mock('../../../src/services/telegram/telegram.fill-subscription.service', () => ({
  TelegramFillSubscriptionService: {
    getInstance: () => ({
      getActiveSubscriptions: async () => {
        if (mockState.loadGate) await mockState.loadGate;
        return mockState.subscriptions;
      },
    }),
  },
}));

jest.mock('../../../src/websocket/ws.server', () => ({
  InternalWebSocketServer: {
    getInstance: () => ({
      broadcastFillAlert: (telegramId: string, message: string) => {
        mockState.broadcasts.push(`${telegramId}|${message}`);
        return 1;
      },
    }),
  },
}));

jest.mock('../../../src/utils/telegram.formatting', () => ({
  formatFillAlert: (fill: AggregatedFill, name: string) =>
    `${name}|${fill.eventId}|${fill.fillCount}|${fill.notionalUsd.toFixed(6)}`,
}));

// ---------------------------------------------------------------------------

/** Pre-refactor matching, verbatim: the oracle. */
function legacyMatches(fill: AggregatedFill, sub: ActiveFillSubscription): boolean {
  if (sub.minUsd > 0 && fill.notionalUsd < sub.minUsd) return false;
  if (sub.maxUsd != null && sub.maxUsd > 0 && fill.notionalUsd > sub.maxUsd) return false;
  if (sub.filterCoins.length > 0) {
    const coinLower = fill.coin.toLowerCase();
    if (!sub.filterCoins.some((c) => c.toLowerCase() === coinLower)) return false;
  }
  if (sub.filterWallets.length > 0) {
    if (!sub.filterWallets.some((w) => w.toLowerCase() === fill.wallet)) return false;
  }
  if (sub.filterSide === 'BUY' && fill.side !== 'B') return false;
  if (sub.filterSide === 'SELL' && fill.side !== 'A') return false;
  if (sub.filterSource === 'PERP' && fill.source !== 'perp') return false;
  if (sub.filterSource === 'SPOT' && fill.source !== 'spot') return false;
  if (sub.filterDirection != null) {
    if (fill.source !== 'perp' || !fill.dir) return false;
    const isOpen = fill.dir.includes('Open');
    const isClose = fill.dir.includes('Close');
    if (sub.filterDirection === 'OPEN' && !isOpen) return false;
    if (sub.filterDirection === 'CLOSE' && !isClose) return false;
  }
  return true;
}

const WALLETS = Array.from({ length: 12 }, (_, i) => `0x${String(i).padStart(40, 'a')}`);
const COINS = ['BTC', 'ETH', 'HYPE', 'SOL', 'PURR', 'kPEPE'];

function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function pick<T>(rnd: () => number, items: readonly T[]): T {
  return items[Math.floor(rnd() * items.length)];
}

function subscription(id: string, overrides: Partial<ActiveFillSubscription> = {}): ActiveFillSubscription {
  return {
    id,
    telegramUserId: `u-${id}`,
    telegramId: `t-${id}`,
    name: `sub-${id}`,
    filterCoins: [],
    filterWallets: [],
    minUsd: 0,
    filterSide: null,
    filterSource: null,
    filterDirection: null,
    maxUsd: null,
    ...overrides,
  };
}

function randomSubscriptions(rnd: () => number, count: number, walletScoped: boolean): ActiveFillSubscription[] {
  return Array.from({ length: count }, (_, i) =>
    subscription(`s${i}`, {
      // Mixed case on purpose: matching is case-insensitive.
      filterWallets: walletScoped || rnd() < 0.5
        ? Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => pick(rnd, WALLETS).toUpperCase().replace('0X', '0x'))
        : [],
      filterCoins: rnd() < 0.4 ? [pick(rnd, COINS).toLowerCase(), pick(rnd, COINS)] : [],
      minUsd: rnd() < 0.3 ? Math.floor(rnd() * 5000) : 0,
      maxUsd: rnd() < 0.2 ? 5000 + Math.floor(rnd() * 20000) : null,
      filterSide: rnd() < 0.2 ? pick(rnd, ['BUY', 'SELL'] as const) : null,
      filterSource: rnd() < 0.2 ? pick(rnd, ['PERP', 'SPOT'] as const) : null,
      filterDirection: rnd() < 0.2 ? pick(rnd, ['OPEN', 'CLOSE'] as const) : null,
    })
  );
}

interface Stream {
  batches: { perp: NormalizedFill[]; spot: SpotFill[] }[];
  /** Same fills as the dispatcher receives them, spot already normalized. */
  normalized: NormalizedFill[];
}

function randomStream(rnd: () => number, orders: number): Stream {
  const batches: Stream['batches'] = [];
  const normalized: NormalizedFill[] = [];
  let oid = 1000;
  for (let o = 0; o < orders; o++) {
    oid += 1;
    const source = rnd() < 0.6 ? 'perp' : 'spot';
    const wallet = pick(rnd, WALLETS);
    const coin = pick(rnd, COINS);
    const side = rnd() < 0.5 ? 'A' : 'B';
    const dir = pick(rnd, ['Open Long', 'Close Short', 'Open Short', 'Close Long', undefined]);
    const fillCount = 1 + Math.floor(rnd() * 4);
    const batch: Stream['batches'][number] = { perp: [], spot: [] };
    for (let f = 0; f < fillCount; f++) {
      const px = 1 + rnd() * 100;
      const sz = rnd() * 200;
      if (source === 'perp') {
        const fill: NormalizedFill = {
          source: 'perp', oid, wallet, coin, px, sz, notionalUsd: px * sz, side,
          time: 1_790_000_000_000 + o, hash: `0xh${oid}`, dir, twapId: null, closedPnl: 0,
        };
        batch.perp.push(fill);
        normalized.push(fill);
      } else {
        const fill: SpotFill = {
          tid: oid * 10 + f, oid, user: wallet, coin, rawCoin: `@${coin}`, px, sz, notionalUsd: px * sz,
          side, time: new Date(1_790_000_000_000 + o).toISOString(), hash: `0xh${oid}`, feeUsdc: 0,
        };
        batch.spot.push(fill);
        normalized.push({
          source: 'spot', oid, wallet, coin, px, sz, notionalUsd: px * sz, side,
          time: fill.time, hash: fill.hash,
        });
      }
    }
    batches.push(batch);
  }
  return { batches, normalized };
}

const drain = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) await new Promise((resolve) => setImmediate(resolve));
};

describe('TelegramFillAlertDispatcherService', () => {
  let Dispatcher: typeof import('../../../src/services/telegram/telegram.fill-alert-dispatcher.service').TelegramFillAlertDispatcherService;
  let FillAggregator: typeof import('../../../src/services/telegram/fill-aggregator').FillAggregator;
  let addSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
    mockState.perpListeners.clear();
    mockState.spotListeners.clear();
    mockState.subscriptions = [];
    mockState.loadGate = null;
    mockState.broadcasts = [];
    mockState.inserted.clear();
    FillAggregator = require('../../../src/services/telegram/fill-aggregator').FillAggregator;
    addSpy = jest.spyOn(FillAggregator.prototype, 'add');
    Dispatcher = require('../../../src/services/telegram/telegram.fill-alert-dispatcher.service')
      .TelegramFillAlertDispatcherService;
  });

  afterEach(() => {
    Dispatcher.getInstance().stop();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const emit = (stream: Stream): void => {
    for (const batch of stream.batches) {
      if (batch.perp.length) for (const cb of mockState.perpListeners) cb(batch.perp);
      if (batch.spot.length) for (const cb of mockState.spotListeners) cb(batch.spot);
    }
  };

  /** Alerts the unfiltered pipeline would have produced for this stream. */
  const expectedAlerts = (stream: Stream, subs: ActiveFillSubscription[]): string[] => {
    const orders: AggregatedFill[] = [];
    const reference = new FillAggregator((agg) => orders.push(agg));
    for (const fill of stream.normalized) reference.add(fill);
    jest.advanceTimersByTime(2_500);
    const alerts: string[] = [];
    for (const order of orders) {
      for (const sub of subs) {
        if (legacyMatches(order, sub)) {
          alerts.push(`${sub.telegramId}|${sub.name}|${order.eventId}|${order.fillCount}|${order.notionalUsd.toFixed(6)}`);
        }
      }
    }
    return alerts.sort();
  };

  const run = async (stream: Stream): Promise<string[]> => {
    emit(stream);
    jest.advanceTimersByTime(2_500);
    await drain();
    return [...mockState.broadcasts].sort();
  };

  it('drops every fill without aggregating it when nobody is subscribed', async () => {
    Dispatcher.getInstance().start();
    await drain();
    const stream = randomStream(rng(1), 400);
    expect(await run(stream)).toEqual([]);
    expect(addSpy).not.toHaveBeenCalled();
  });

  it('aggregates only the fills of watched wallets when every subscription is wallet-scoped', async () => {
    const rnd = rng(2);
    mockState.subscriptions = randomSubscriptions(rnd, 5, true);
    Dispatcher.getInstance().start();
    await drain();

    const stream = randomStream(rnd, 600);
    const watched = new Set(mockState.subscriptions.flatMap((s) => s.filterWallets.map((w) => w.toLowerCase())));
    const expected = expectedAlerts(stream, mockState.subscriptions);
    addSpy.mockClear();

    const alerts = await run(stream);
    expect(alerts).toEqual(expected);
    expect(expected.length).toBeGreaterThan(0);
    const aggregatedWallets = new Set(addSpy.mock.calls.map(([fill]) => (fill as NormalizedFill).wallet));
    for (const wallet of aggregatedWallets) expect(watched.has(wallet)).toBe(true);
    expect(addSpy.mock.calls.length).toBe(stream.normalized.filter((f) => watched.has(f.wallet)).length);
  });

  it.each([3, 4, 5, 6, 7, 8])('alerts exactly like the unfiltered pipeline (mixed subscriptions, seed %i)', async (seed) => {
    const rnd = rng(seed);
    mockState.subscriptions = randomSubscriptions(rnd, 8, false);
    Dispatcher.getInstance().start();
    await drain();

    const stream = randomStream(rnd, 800);
    const expected = expectedAlerts(stream, mockState.subscriptions);
    expect(expected.length).toBeGreaterThan(0);
    expect(await run(stream)).toEqual(expected);
  });

  it('keeps the unfiltered path until the first subscription load completes', async () => {
    let release!: () => void;
    mockState.loadGate = new Promise<void>((resolve) => { release = resolve; });
    mockState.subscriptions = [subscription('a', { filterWallets: [WALLETS[0]] })];
    Dispatcher.getInstance().start();
    await drain();

    const stream = randomStream(rng(9), 50);
    emit(stream);
    expect(addSpy).toHaveBeenCalledTimes(stream.normalized.length);

    release();
    jest.advanceTimersByTime(2_500);
    await drain();
    expect([...mockState.broadcasts].sort()).toEqual(expectedAlerts(stream, mockState.subscriptions));
  });

  it('picks up subscriptions created after start within one refresh period', async () => {
    Dispatcher.getInstance().start();
    await drain();
    mockState.subscriptions = [subscription('late')];

    jest.advanceTimersByTime(30_000);
    await drain();

    const stream = randomStream(rng(10), 20);
    expect(await run(stream)).toEqual(expectedAlerts(stream, mockState.subscriptions));
    expect(mockState.broadcasts.length).toBe(20);
  });
});

describe('SerialQueue', () => {
  it('drops tasks beyond maxPending and accepts new ones once the backlog drains', async () => {
    const { SerialQueue } = require('../../../src/utils/telegram.alert-dedup');
    const queue = new SerialQueue('test', 3);
    const ran: number[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });

    for (let i = 1; i <= 5; i++) {
      queue.enqueue(async () => {
        if (i === 1) await gate;
        ran.push(i);
      });
    }
    release();
    await drain();
    expect(ran).toEqual([1, 2, 3]);

    queue.enqueue(async () => { ran.push(6); });
    await drain();
    expect(ran).toEqual([1, 2, 3, 6]);
  });
});
