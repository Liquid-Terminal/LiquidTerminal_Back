jest.mock('../../../src/core/prisma.service', () => ({ prisma: {} }));
jest.mock('../../../src/core/prisma.telegram.service', () => ({ prismaTelegram: {} }));
jest.mock('../../../src/core/redis.service', () => ({ redisService: {} }));
jest.mock('../../../src/websocket/ws.server', () => ({ InternalWebSocketServer: { getInstance: () => ({}) } }));
jest.mock('../../../src/services/liquidations/liquidations.ws.service', () => ({ LiquidationsWebSocketService: {} }));
jest.mock('../../../src/clients/hyperliquid/perp/perp.assetcontext.client', () => ({ HyperliquidPerpClient: {} }));
jest.mock('../../../src/utils/logDeduplicator', () => ({
  logDeduplicator: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import {
  MarketSnapshotTracker,
  CascadeTracker,
  compileMarketRules,
  formatMarketAlert,
  MarketEvent,
  MarketRuleRow,
  MARKET_WIDE,
  PerpRow,
  reserveYieldEvents,
  LedgerUpdate,
} from '../../../src/services/alerts/market-alerts.service';
import { parseRuleParams, defaultRuleName } from '../../../src/services/alerts/alert-rule.types';
import { TelegramFillAlertDispatcherService } from '../../../src/services/telegram/telegram.fill-alert-dispatcher.service';
import type { AggregatedLiquidation } from '../../../src/types/liquidations.types';

const MIN = 60_000;
const row = (name: string, px: number, o: Partial<PerpRow> = {}): PerpRow => ({
  name, maxLeverage: 20, markPx: px, prevDayPx: px, funding: 0.0000125, openInterest: 1000, ...o,
});
const ticks = (events: MarketEvent[]) => events.filter((e): e is Extract<MarketEvent, { kind: 'tick' }> => e.kind === 'tick');

describe('MarketSnapshotTracker', () => {
  it('seeds known coins on the first snapshot, then reports only new ones as listings', () => {
    const t = new MarketSnapshotTracker();
    expect(t.update([row('BTC', 1), row('ETH', 1)], 0).filter((e) => e.kind === 'listing')).toHaveLength(0);
    const ev = t.update([row('BTC', 1), row('ETH', 1), row('NEW', 1, { maxLeverage: 5 })], 10_000);
    expect(ev.filter((e) => e.kind === 'listing').map((e) => e.coin)).toEqual(['NEW']);
  });

  it('keeps listings found while it was down when restarted with the stored coin set', () => {
    const t = new MarketSnapshotTracker(['BTC']);
    expect(t.update([row('BTC', 1), row('NEW', 1)], 0).filter((e) => e.kind === 'listing').map((e) => e.coin)).toEqual(['NEW']);
  });

  it('ignores delisted markets', () => {
    const t = new MarketSnapshotTracker(['BTC']);
    expect(t.update([row('BTC', 1), row('OLD', 1, { isDelisted: true })], 0).map((e) => e.coin)).toEqual(['BTC']);
  });

  it('reports 1h changes only once it holds close to an hour of samples', () => {
    const t = new MarketSnapshotTracker(['BTC']);
    t.update([row('BTC', 100, { openInterest: 10 })], 0);
    expect(ticks(t.update([row('BTC', 110)], 30 * MIN))[0].change1hPct).toBeNull();
    const late = ticks(t.update([row('BTC', 120, { openInterest: 20 })], 56 * MIN))[0];
    expect(late.change1hPct).toBeCloseTo(20);
    expect(late.oiChange1hPct).toBeCloseTo(((20 * 120 - 10 * 100) / (10 * 100)) * 100);
  });

  it('reports 24h change from prevDayPx, annualized funding, and leverage changes', () => {
    const t = new MarketSnapshotTracker(['BTC']);
    t.update([row('BTC', 100, { prevDayPx: 80, funding: 0.0001 })], 0);
    const ev = t.update([row('BTC', 100, { prevDayPx: 80, maxLeverage: 10, funding: 0.0001 })], 10_000);
    const tick = ticks(ev)[0];
    expect(tick.change24hPct).toBeCloseTo(25);
    expect(tick.fundingAprPct).toBeCloseTo(87.6);
    expect(ev.find((e) => e.kind === 'leverage')).toMatchObject({ coin: 'BTC', from: 20, to: 10 });
  });
});

describe('CascadeTracker', () => {
  const liq = (coin: string, usd: number, hash: string) =>
    ({ coin, notional_total: usd, hash } as unknown as AggregatedLiquidation);

  it('sums 60s per coin and market-wide, and forgets older liquidations', () => {
    const c = new CascadeTracker();
    c.add(liq('eth', 100_000, 'a'), 0);
    c.add(liq('BTC', 50_000, 'b'), 1000);
    const ev = c.add(liq('ETH', 30_000, 'c'), 30_000);
    expect(ev.find((e) => e.coin === 'ETH')).toMatchObject({ usd60s: 130_000, count60s: 2, scope: 'coin' });
    expect(ev.find((e) => e.coin === MARKET_WIDE)).toMatchObject({ usd60s: 180_000, count60s: 3, scope: 'market' });
    const later = c.add(liq('ETH', 1, 'd'), 95_000);
    expect(later.find((e) => e.coin === 'ETH')).toMatchObject({ usd60s: 1, count60s: 1 });
  });
});

describe('compileMarketRules', () => {
  const rule = (type: MarketRuleRow['type'], params: unknown, id = 'r1'): MarketRuleRow => ({
    id, telegramId: '7', type, name: 'n', params: parseRuleParams(type, params),
  });
  const tick = (coin: string, px: number, prevPx: number | null, ts: number, o: Partial<Extract<MarketEvent, { kind: 'tick' }>> = {}): MarketEvent => ({
    kind: 'tick', id: `t${ts}`, coin, ts, px, prevPx, change1hPct: null, change24hPct: null, fundingAprPct: 0, oiUsd: 0, oiChange1hPct: null, ...o,
  });

  it('price_cross fires on the crossing only, then waits out its cooldown', () => {
    const cd = new Map<string, number>();
    const [r] = compileMarketRules([rule('price_cross', { coin: 'btc', level: 100, direction: 'above' })], cd);
    expect(r.coins).toEqual(['BTC']);
    expect(r.matches(tick('BTC', 99, 98, 0))).toBe(false);
    expect(r.matches(tick('BTC', 101, 99, 10_000))).toBe(true);
    expect(r.matches(tick('BTC', 102, 101, 20_000))).toBe(false); // already above, no crossing
    expect(r.matches(tick('BTC', 101, 99, 5 * MIN))).toBe(false); // cooldown
    // Recompiling (every 30s) keeps the cooldown.
    const [again] = compileMarketRules([rule('price_cross', { coin: 'BTC', level: 100, direction: 'above' })], cd);
    expect(again.matches(tick('BTC', 101, 99, 6 * MIN))).toBe(false);
    expect(again.matches(tick('BTC', 101, 99, 16 * MIN))).toBe(true);
  });

  it('price_move on any coin keeps a cooldown per coin', () => {
    const [r] = compileMarketRules([rule('price_move', { coin: null, pct: 5, window: '1h', direction: 'down' })], new Map());
    expect(r.coins).toEqual([]);
    expect(r.matches(tick('ETH', 1, 1, 0, { change1hPct: 6 }))).toBe(false);
    expect(r.matches(tick('ETH', 1, 1, 0, { change1hPct: -6 }))).toBe(true);
    expect(r.matches(tick('SOL', 1, 1, 0, { change1hPct: -7 }))).toBe(true);
    expect(r.matches(tick('ETH', 1, 1, 30 * MIN, { change1hPct: -8 }))).toBe(false);
  });

  it('funding and oi_surge respect thresholds and the OI floor', () => {
    const [f, o] = compileMarketRules(
      [rule('funding', { aprPct: 100 }, 'f'), rule('oi_surge', { pct: 20, minOiUsd: 1_000_000 }, 'o')],
      new Map()
    );
    expect(f.matches(tick('X', 1, 1, 0, { fundingAprPct: -150 }))).toBe(true);
    expect(f.matches(tick('Y', 1, 1, 0, { fundingAprPct: 50 }))).toBe(false);
    expect(o.matches(tick('X', 1, 1, 0, { oiChange1hPct: 25, oiUsd: 500_000 }))).toBe(false);
    expect(o.matches(tick('X', 1, 1, 0, { oiChange1hPct: 25, oiUsd: 5_000_000 }))).toBe(true);
  });

  it('liq_cascade without a coin only matches market-wide totals', () => {
    const [m, c] = compileMarketRules(
      [rule('liq_cascade', { minUsd: 1_000_000 }, 'm'), rule('liq_cascade', { coin: 'eth', minUsd: 500_000 }, 'c')],
      new Map()
    );
    expect(m.coins).toEqual([MARKET_WIDE]);
    const ev = (coin: string, usd: number, scope: 'coin' | 'market'): MarketEvent => ({ kind: 'cascade', id: coin, coin, ts: 0, usd60s: usd, count60s: 3, scope });
    expect(m.matches(ev('ETH', 2_000_000, 'coin'))).toBe(false);
    expect(m.matches(ev(MARKET_WIDE, 2_000_000, 'market'))).toBe(true);
    expect(c.matches(ev('ETH', 600_000, 'coin'))).toBe(true);
  });

  it('formats a readable message with the rule name and a link', () => {
    const [r] = compileMarketRules([rule('price_cross', { coin: 'BTC', level: 100, direction: 'above' })], new Map());
    const msg = formatMarketAlert(r, tick('BTC', 101, 99, 0));
    expect(msg).toContain('crossed above $100');
    expect(msg).toContain('https://liquidterminal.xyz/market/perp/BTC');
    expect(msg).not.toContain('—');
  });
});

describe('alert rule params', () => {
  it('validates per type and rejects unknown fields', () => {
    expect(() => parseRuleParams('price_cross', { coin: 'BTC', level: -1, direction: 'above' })).toThrow();
    expect(() => parseRuleParams('listing', { extra: 1 })).toThrow();
    expect(() => parseRuleParams('liq_cascade', { minUsd: 100 })).toThrow();
    expect(parseRuleParams('price_move', { pct: '5', window: '24h' })).toEqual({ coin: null, pct: 5, window: '24h', direction: 'both' });
    expect(defaultRuleName('liq_cascade', parseRuleParams('liq_cascade', { minUsd: 5_000_000 }))).toBe('Market-wide liquidations $5.0M+ in 60s');
  });
});

describe('fill alerts: flips', () => {
  it("FLIP matches Hyperliquid's 'Long > Short' and 'Short > Long' only", () => {
    const sub = { id: 's', telegramUserId: 'u', telegramId: '1', name: 'n', filterCoins: [], filterWallets: [], minUsd: 0,
      filterSide: null, filterSource: null, filterDirection: 'FLIP' as const, maxUsd: null };
    const fill = (dir: string) => ({ source: 'perp' as const, eventId: 'e', oid: 1, wallet: '0xa', coin: 'BTC', px: 1, sz: 1,
      notionalUsd: 1, side: 'B' as const, time: 0, hash: '0x', dir, fillCount: 1 });
    expect(TelegramFillAlertDispatcherService.matchesFilters(fill('Long > Short'), sub)).toBe(true);
    expect(TelegramFillAlertDispatcherService.matchesFilters(fill('Short > Long'), sub)).toBe(true);
    expect(TelegramFillAlertDispatcherService.matchesFilters(fill('Open Long'), sub)).toBe(false);
  });
});

describe('reserve yield', () => {
  // The interest address ledger as it read on 3 Oct 2026.
  const ledger: LedgerUpdate[] = [
    { time: 1787855644307, hash: '0x8248', delta: { type: 'send', user: '0x8536a52900b5e7b23b08d6dcc50fd5689b5e270c', destination: '0x5000000000000000000000000000000000000000', token: 'USDC', amount: '1.0' } },
    { time: 1790960738677, hash: '0x7009', delta: { type: 'send', user: '0x8536a52900b5e7b23b08d6dcc50fd5689b5e270c', destination: '0x5000000000000000000000000000000000000000', token: 'USDC', amount: '1.0' } },
    { time: 1790985600106, hash: '0x' + '0'.repeat(64), delta: { type: 'send', user: '0x5000000000000000000000000000000000000000', destination: '0xfefefefefefefefefefefefefefefefefefefefe', token: 'USDC', amount: '2.0' } },
    { time: 1790995390017, hash: '0x4f7f', delta: { type: 'send', user: '0x8536a52900b5e7b23b08d6dcc50fd5689b5e270c', destination: '0x5000000000000000000000000000000000000000', token: 'USDC', amount: '14580777.2100000009' } },
  ];
  const forward: LedgerUpdate = {
    time: 1791072000106,
    hash: '0x' + '0'.repeat(64),
    delta: { type: 'send', user: '0x5000000000000000000000000000000000000000', destination: '0xfefefefefefefefefefefefefefefefefefefefe', token: 'USDC', amount: '14580777.21' },
  };

  it('turns the payment into one event and ignores 1-2 USDC test transfers', () => {
    const events = reserveYieldEvents(ledger, 0);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'reserve_yield', stage: 'paid', amount: 14580777.21 });
  });

  it('reports the forward to the Assistance Fund and skips what the cursor already passed', () => {
    const events = reserveYieldEvents([...ledger, forward], 1790995390017);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ stage: 'to_fund', amount: 14580777.21 });
  });

  it('matches reserve_yield rules and formats both stages with a link to the page', () => {
    const [rule] = compileMarketRules(
      [{ id: 'r1', telegramId: '1', type: 'reserve_yield', name: defaultRuleName('reserve_yield', parseRuleParams('reserve_yield', {})), params: parseRuleParams('reserve_yield', {}) }],
      new Map()
    );
    const [paid] = reserveYieldEvents(ledger, 0);
    const [fwd] = reserveYieldEvents([forward], 0);
    expect(rule.matches(paid)).toBe(true);
    expect(formatMarketAlert(rule, paid)).toContain('14,580,777.21 USDC');
    expect(formatMarketAlert(rule, paid)).toContain('/explorer/transaction/0x4f7f');
    expect(formatMarketAlert(rule, fwd)).toContain('Assistance Fund');
    expect(formatMarketAlert(rule, fwd)).not.toContain('/explorer/transaction/');
    expect(formatMarketAlert(rule, fwd)).toContain('/hype/reserve-yield');
    expect(() => parseRuleParams('reserve_yield', { coin: 'BTC' })).toThrow();
  });
});
