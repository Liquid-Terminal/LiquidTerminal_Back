/**
 * The wallet dispatcher consumes the network-wide completed trades feed while
 * every subscription is wallet-scoped: once the subscriptions are known, only
 * trades of a watched wallet may reach the queue — and the alerts must be
 * exactly those of the unfiltered pipeline (oracle: the pre-refactor matching).
 */
import type { CompletedTrade } from '../../../src/types/wallet-events.types';

interface WalletSubscription {
  id: string;
  telegramId: string;
  name: string;
  walletAddresses: string[];
  eventTypes: string[];
  minAmountUsd: number;
}

const mockState = {
  listeners: new Set<(trades: CompletedTrade[]) => void>(),
  subscriptions: [] as WalletSubscription[],
  loadGate: null as Promise<void> | null,
  broadcasts: [] as string[],
  inserted: new Set<string>(),
  paused: [] as boolean[],
};

jest.mock('../../../src/utils/logDeduplicator', () => ({
  logDeduplicator: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../src/core/prisma.telegram.service', () => ({
  prismaTelegram: {
    telegramWalletSentAlert: {
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

jest.mock('../../../src/clients/hypedexer/rest/completed-trades/completed-trades-poller.client', () => ({
  HypeDexerCompletedTradesPoller: {
    getInstance: () => ({
      onCompletedTrade: (cb: (trades: CompletedTrade[]) => void) => {
        mockState.listeners.add(cb);
        return () => mockState.listeners.delete(cb);
      },
      setPaused: (paused: boolean) => {
        mockState.paused.push(paused);
      },
      start: () => undefined,
      stop: () => undefined,
    }),
  },
}));

jest.mock('../../../src/services/telegram/telegram.wallet-subscription.service', () => ({
  TelegramWalletSubscriptionService: {
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
      broadcastWalletEvent: (telegramId: string, trade: CompletedTrade, name: string) => {
        mockState.broadcasts.push(`${telegramId}|${name}|${trade.tradeId}`);
      },
    }),
  },
}));

const WALLETS = Array.from({ length: 30 }, (_, i) => `0x${String(i).padStart(40, 'b')}`);

function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function randomSubscriptions(rnd: () => number, count: number): WalletSubscription[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `s${i}`,
    telegramId: `t${i}`,
    name: `sub-${i}`,
    // Mixed case on purpose: matching is case-insensitive; some subs watch nothing.
    walletAddresses: Array.from({ length: Math.floor(rnd() * 4) }, () =>
      WALLETS[Math.floor(rnd() * WALLETS.length)].toUpperCase().replace('0X', '0x')
    ),
    eventTypes: [[], ['TRADE'], ['LIQUIDATION']][Math.floor(rnd() * 3)],
    minAmountUsd: rnd() < 0.5 ? 0 : Math.floor(rnd() * 50_000),
  }));
}

function randomBatches(rnd: () => number, batches: number): CompletedTrade[][] {
  let id = 0;
  return Array.from({ length: batches }, () =>
    Array.from({ length: 1 + Math.floor(rnd() * 5) }, () => ({
      tradeId: `tr${++id}`,
      user: WALLETS[Math.floor(rnd() * WALLETS.length)],
      coin: 'BTC',
      direction: 'long' as const,
      pnlRealized: 0,
      pnlPercentage: 0,
      positionValue: rnd() * 100_000,
      entryPrice: 1,
      exitPrice: 1,
      totalFees: 0,
      totalVolume: 0,
      durationSeconds: 1,
      endTime: '2026-09-24T00:00:00Z',
      closeHash: '0x',
    }))
  );
}

/** Pre-refactor matching, verbatim: the oracle. */
function expectedAlerts(batches: CompletedTrade[][], subs: WalletSubscription[]): string[] {
  const alerts: string[] = [];
  for (const trade of batches.flat()) {
    for (const sub of subs) {
      if (!sub.walletAddresses.some((addr) => addr.toLowerCase() === trade.user)) continue;
      if (sub.eventTypes.length > 0 && !sub.eventTypes.includes('TRADE')) continue;
      if (trade.positionValue < sub.minAmountUsd) continue;
      alerts.push(`${sub.telegramId}|${sub.name}|${trade.tradeId}`);
    }
  }
  return alerts.sort();
}

const drain = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) await new Promise((resolve) => setImmediate(resolve));
};

describe('TelegramWalletDispatcherService', () => {
  let Dispatcher: typeof import('../../../src/services/telegram/telegram.wallet-dispatcher.service').TelegramWalletDispatcherService;
  let enqueueSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    mockState.listeners.clear();
    mockState.subscriptions = [];
    mockState.loadGate = null;
    mockState.broadcasts = [];
    mockState.inserted.clear();
    mockState.paused = [];
    const { SerialQueue } = require('../../../src/utils/telegram.alert-dedup');
    enqueueSpy = jest.spyOn(SerialQueue.prototype, 'enqueue');
    Dispatcher = require('../../../src/services/telegram/telegram.wallet-dispatcher.service')
      .TelegramWalletDispatcherService;
  });

  afterEach(() => {
    Dispatcher.getInstance().stop();
    jest.restoreAllMocks();
  });

  const emit = (batches: CompletedTrade[][]): void => {
    for (const batch of batches) for (const cb of mockState.listeners) cb(batch);
  };

  it.each([1, 2, 3, 4])('queues only watched trades and alerts like the unfiltered pipeline (seed %i)', async (seed) => {
    const rnd = rng(seed);
    mockState.subscriptions = randomSubscriptions(rnd, 6);
    Dispatcher.getInstance().start();
    await drain();

    const batches = randomBatches(rnd, 300);
    const watched = new Set(mockState.subscriptions.flatMap((s) => s.walletAddresses.map((a) => a.toLowerCase())));
    const expected = expectedAlerts(batches, mockState.subscriptions);
    expect(expected.length).toBeGreaterThan(0);

    emit(batches);
    await drain();

    expect([...mockState.broadcasts].sort()).toEqual(expected);
    const queuedTrades = enqueueSpy.mock.calls.length;
    const batchesWithWatched = batches.filter((b) => b.some((t) => watched.has(t.user))).length;
    expect(queuedTrades).toBe(batchesWithWatched);
  });

  it('queues nothing when no subscription exists', async () => {
    Dispatcher.getInstance().start();
    await drain();
    emit(randomBatches(rng(7), 100));
    await drain();
    expect(enqueueSpy).not.toHaveBeenCalled();
    expect(mockState.broadcasts).toEqual([]);
  });

  it('queues every batch until the first subscription load completes', async () => {
    let release!: () => void;
    mockState.loadGate = new Promise<void>((resolve) => { release = resolve; });
    mockState.subscriptions = randomSubscriptions(rng(8), 4);
    Dispatcher.getInstance().start();
    await drain();

    const batches = randomBatches(rng(9), 40);
    emit(batches);
    expect(enqueueSpy).toHaveBeenCalledTimes(batches.length);

    release();
    await drain();
    expect([...mockState.broadcasts].sort()).toEqual(expectedAlerts(batches, mockState.subscriptions));
  });

  it('pauses the feed while no wallet is watched and resumes it once one is', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
    try {
      // A subscription that watches nothing cannot produce an alert either.
      mockState.subscriptions = [
        { id: 's0', telegramId: 't0', name: 'empty', walletAddresses: [], eventTypes: [], minAmountUsd: 0 },
      ];
      Dispatcher.getInstance().start();
      await drain();
      expect(mockState.paused).toEqual([true]);

      mockState.subscriptions = [
        { id: 's1', telegramId: 't1', name: 'one', walletAddresses: [WALLETS[0]], eventTypes: [], minAmountUsd: 0 },
      ];
      jest.advanceTimersByTime(30_000);
      await drain();
      expect(mockState.paused).toEqual([true, false]);
    } finally {
      jest.useRealTimers();
    }
  });
});
