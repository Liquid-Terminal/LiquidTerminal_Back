const claimKeys = jest.fn();
jest.mock('../../../src/core/redis.service', () => ({
  redisService: { claimKeys: (...a: unknown[]) => claimKeys(...a) },
}));
jest.mock('../../../src/utils/logDeduplicator', () => ({
  logDeduplicator: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../../src/core/prisma.service', () => ({ prisma: {} }));
jest.mock('../../../src/core/prisma.telegram.service', () => ({ prismaTelegram: {} }));
jest.mock('../../../src/websocket/ws.server', () => ({ InternalWebSocketServer: { getInstance: () => ({}) } }));
jest.mock('../../../src/services/liquidations/liquidations.ws.service', () => ({ LiquidationsWebSocketService: {} }));

import {
  AlertEngine,
  AlertRule,
  RuleIndex,
  DeliveryLimiter,
  BoundedSerialQueue,
} from '../../../src/services/alerts/alert-engine';
import { TelegramFillAlertDispatcherService } from '../../../src/services/telegram/telegram.fill-alert-dispatcher.service';
import { compileLiquidationRules } from '../../../src/services/telegram/telegram.liquidation-dispatcher.service';
import type { ActiveFillSubscription } from '../../../src/services/telegram/telegram.fill-subscription.service';
import type { AggregatedFill } from '../../../src/types/fill-alerts.types';
import type { AggregatedLiquidation } from '../../../src/types/liquidations.types';

interface Ev { id: string; wallet: string; coin: string; usd: number }

// Deterministic PRNG so a failure reproduces.
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}
const pick = <T>(r: () => number, xs: T[]) => xs[Math.floor(r() * xs.length)];

describe('RuleIndex', () => {
  it('returns exactly the rules a full scan would match (randomized parity)', () => {
    const r = rng(42);
    const wallets = Array.from({ length: 30 }, (_, i) => `0x${i.toString(16).padStart(40, '0')}`);
    const coins = ['BTC', 'ETH', 'HYPE', 'SOL', 'PURR'];
    const rules: AlertRule<Ev>[] = Array.from({ length: 400 }, (_, i) => {
      const w = r() < 0.5 ? Array.from({ length: 1 + Math.floor(r() * 4) }, () => pick(r, wallets)) : [];
      const c = r() < 0.4 ? Array.from({ length: 1 + Math.floor(r() * 2) }, () => pick(r, coins)) : [];
      const min = r() < 0.5 ? Math.floor(r() * 1000) : 0;
      return { id: `r${i}`, telegramId: '1', wallets: w, coins: c, dedupScope: `r${i}`, matches: (e: Ev) => e.usd >= min };
    });
    const index = new RuleIndex(rules);
    for (let n = 0; n < 2000; n++) {
      const e: Ev = { id: `e${n}`, wallet: pick(r, wallets), coin: pick(r, coins).toLowerCase(), usd: Math.floor(r() * 1500) };
      const scan = rules
        .filter(
          (rule) =>
            (rule.wallets.length === 0 || rule.wallets.includes(e.wallet)) &&
            (rule.coins.length === 0 || rule.coins.includes(e.coin.toUpperCase())) &&
            rule.matches(e)
        )
        .map((x) => x.id)
        .sort();
      const viaIndex = index
        .candidates({ id: e.id, wallets: [e.wallet], coin: e.coin })
        .filter((rule) => rule.matches(e))
        .map((x) => x.id)
        .sort();
      expect(viaIndex).toEqual(scan);
    }
  });

  it('never returns a rule twice when its wallet list repeats an address', () => {
    const rule: AlertRule<Ev> = { id: 'a', telegramId: '1', wallets: ['0x1', '0x1'], coins: [], dedupScope: 'a', matches: () => true };
    expect(new RuleIndex([rule]).candidates({ id: 'e', wallets: ['0x1'], coin: 'BTC' })).toHaveLength(1);
  });
});

describe('DeliveryLimiter', () => {
  it('caps a user per window and reports what it held back once', () => {
    let t = 0;
    const lim = new DeliveryLimiter(3, 1000, () => t);
    expect([1, 2, 3, 4, 5].map(() => lim.allow('u'))).toEqual([true, true, true, false, false]);
    expect(lim.allow('other')).toBe(true);
    expect(lim.drainHeld()).toEqual([]);
    t = 1000;
    expect(lim.drainHeld()).toEqual([{ user: 'u', held: 2 }]);
    expect(lim.allow('u')).toBe(true);
  });
});

describe('BoundedSerialQueue', () => {
  it('drops the oldest batches past its cap and processes in order', async () => {
    const seen: number[] = [];
    let release!: () => void;
    const gate = new Promise<void>((res) => (release = res));
    const q = new BoundedSerialQueue<number>(2, async (n) => {
      if (n === 0) await gate;
      seen.push(n);
    }, 'test');
    [0, 1, 2, 3, 4].forEach((n) => q.push(n));
    expect(q.dropped).toBe(2);
    release();
    await new Promise((r) => setTimeout(r, 10));
    expect(seen).toEqual([0, 3, 4]);
  });
});

describe('AlertEngine', () => {
  const makeEngine = (rules: AlertRule<Ev>[], limiter = new DeliveryLimiter(100, 60_000)) => {
    const delivered: string[] = [];
    const engine = new AlertEngine<Ev>(
      {
        name: 'test',
        loadRules: async () => rules,
        keys: (e) => ({ id: e.id, wallets: [e.wallet], coin: e.coin }),
        deliver: (rule, e) => delivered.push(`${rule.id}:${e.id}`),
        notify: () => undefined,
      },
      { limiter }
    );
    return { engine, delivered };
  };
  const rule = (id: string, extra: Partial<AlertRule<Ev>> = {}): AlertRule<Ev> => ({
    id, telegramId: 't1', wallets: ['0xa'], coins: [], dedupScope: id, matches: () => true, ...extra,
  });
  const ev = (id: string): Ev => ({ id, wallet: '0xa', coin: 'BTC', usd: 1 });

  beforeEach(() => claimKeys.mockReset());

  it('delivers once per (scope, event), even when the stream repeats it', async () => {
    claimKeys.mockImplementation(async (keys: string[]) => keys.map(() => true));
    const { engine, delivered } = makeEngine([rule('r1')]);
    await engine.process([ev('e1'), ev('e1')]);
    await engine.process([ev('e1')]);
    expect(delivered).toEqual(['r1:e1']);
  });

  it('skips events another instance already claimed in Redis', async () => {
    claimKeys.mockImplementation(async (keys: string[]) => keys.map(() => false));
    const { engine, delivered } = makeEngine([rule('r1')]);
    await engine.process([ev('e1')]);
    expect(delivered).toEqual([]);
  });

  it('fails open on memory dedup when Redis is down', async () => {
    claimKeys.mockResolvedValue(null);
    const { engine, delivered } = makeEngine([rule('r1')]);
    await engine.process([ev('e1'), ev('e1'), ev('e2')]);
    expect(delivered).toEqual(['r1:e1', 'r1:e2']);
  });

  it('shares a per-user dedup scope across subscriptions', async () => {
    claimKeys.mockImplementation(async (keys: string[]) => keys.map(() => true));
    const { engine, delivered } = makeEngine([rule('r1', { dedupScope: 'user1' }), rule('r2', { dedupScope: 'user1' })]);
    await engine.process([ev('e1')]);
    expect(delivered).toEqual(['r1:e1']);
  });

  it('holds back alerts past the per-user budget', async () => {
    claimKeys.mockImplementation(async (keys: string[]) => keys.map(() => true));
    const { engine, delivered } = makeEngine([rule('r1')], new DeliveryLimiter(2, 60_000));
    await engine.process([ev('e1'), ev('e2'), ev('e3')]);
    expect(delivered).toEqual(['r1:e1', 'r1:e2']);
  });
});

describe('fill rules keep their old semantics', () => {
  const sub = (o: Partial<ActiveFillSubscription>): ActiveFillSubscription => ({
    id: 's', telegramUserId: 'u', telegramId: '1', name: 'n', filterCoins: [], filterWallets: [], minUsd: 0,
    filterSide: null, filterSource: null, filterDirection: null, maxUsd: null, ...o,
  });
  const fill = (o: Partial<AggregatedFill>): AggregatedFill => ({
    source: 'perp', eventId: 'e', oid: 1, wallet: '0xa', coin: 'BTC', px: 1, sz: 1, notionalUsd: 50_000,
    side: 'B', time: 0, hash: '0x', dir: 'Open Long', fillCount: 1, ...o,
  });
  const m = TelegramFillAlertDispatcherService.matchesFilters;

  it('applies size, side, source and direction', () => {
    expect(m(fill({}), sub({ minUsd: 100_000 }))).toBe(false);
    expect(m(fill({}), sub({ maxUsd: 10_000 }))).toBe(false);
    expect(m(fill({ side: 'A' }), sub({ filterSide: 'BUY' }))).toBe(false);
    expect(m(fill({ source: 'spot', dir: undefined }), sub({ filterSource: 'PERP' }))).toBe(false);
    expect(m(fill({ dir: 'Close Long' }), sub({ filterDirection: 'OPEN' }))).toBe(false);
    expect(m(fill({ coin: 'btc' }), sub({ filterCoins: ['BTC'], filterWallets: ['0xA'] }))).toBe(true);
  });
});

describe('liquidation rules keep their old semantics', () => {
  const row = (o: Record<string, unknown>) => ({
    id: 's1', telegramUserId: 'u1', subscriptionType: 'filtered', filterCoins: [], filterMinUsd: 0,
    filterWallets: [], useLinkedWallets: false, telegramUser: { telegramId: BigInt(7), linkedUserId: 3 }, ...o,
  });
  const liq = { hash: 'h', coin: 'eth', notional_total: 5000, liquidated_user: '0xAB' } as unknown as AggregatedLiquidation;

  it("'all' matches everything; filters apply otherwise; dedup is per user", () => {
    const [all] = compileLiquidationRules([row({ subscriptionType: 'all', filterMinUsd: 1e9 })], new Map());
    expect(all.wallets).toEqual([]);
    expect(all.matches(liq)).toBe(true);
    expect(all.dedupScope).toBe('u1');

    const [min] = compileLiquidationRules([row({ filterMinUsd: 10_000, filterCoins: ['ETH'] })], new Map());
    expect(min.coins).toEqual(['ETH']);
    expect(min.matches(liq)).toBe(false);
  });

  it('uses linked wallets when asked, and drops the rule when there are none', () => {
    expect(compileLiquidationRules([row({ useLinkedWallets: true })], new Map())).toHaveLength(0);
    const [r] = compileLiquidationRules(
      [row({ useLinkedWallets: true, filterWallets: ['0xignored'] })],
      new Map([[3, ['0xab']]])
    );
    expect(r.wallets).toEqual(['0xab']);
  });
});
