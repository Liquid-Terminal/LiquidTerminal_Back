import { buildTokenHoldersView, HOLDER_TIERS } from '../../../src/utils/token-holders.util';

describe('buildTokenHoldersView', () => {
  it('sums the spot and staked balances of an address and counts it once', () => {
    const view = buildTokenHoldersView(
      'HYPE',
      { lastUpdate: 100, holders: { a: 5, b: 0.0001, c: 2 } },
      { lastUpdate: 120, holders: { b: 10_000, d: 7 } },
      10
    );

    expect(view.holdersCount).toBe(4);
    expect(view.top).toEqual([
      { address: 'b', amount: 10_000.0001, staked: 10_000 },
      { address: 'd', amount: 7, staked: 7 },
      { address: 'a', amount: 5, staked: 0 },
      { address: 'c', amount: 2, staked: 0 },
    ]);
    expect(view.totalBalance).toBeCloseTo(10_014.0001, 8);
    expect(view.lastUpdate).toBe(120);
    expect(view.token).toBe('HYPE');
  });

  it('keeps only the largest maxRows holders but counts every holder', () => {
    const holders: Record<string, number> = {};
    for (let i = 1; i <= 1000; i++) holders[`0x${i}`] = (i * 7919) % 1000 + i / 10_000;
    const view = buildTokenHoldersView('X', { holders }, {}, 25);

    const expected = Object.entries(holders)
      .map(([address, amount]) => ({ address, amount, staked: 0 }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 25);
    expect(view.top).toEqual(expected);
    expect(view.holdersCount).toBe(1000);
  });

  it('buckets every holder into the first tier whose threshold it clears', () => {
    const view = buildTokenHoldersView(
      'HYPE',
      { holders: { w: 100_000, s: 99_999, d: 1_000, f: 100, r: 99.9, dust: 1e-8 } },
      {},
      1
    );

    expect(view.cohorts.map((c) => [c.label, c.count])).toEqual([
      ['Whale', 1], ['Shark', 1], ['Dolphin', 1], ['Fish', 1], ['Shrimp', 2],
    ]);
    expect(view.cohorts.map((c) => c.min)).toEqual(HOLDER_TIERS.map((t) => t.min));
    expect(view.cohorts[4].balance).toBeCloseTo(99.9 + 1e-8, 10);
    // Tiers cover every holder, not just the kept rows.
    expect(view.cohorts.reduce((n, c) => n + c.count, 0)).toBe(view.holdersCount);
    expect(view.cohorts.reduce((n, c) => n + c.balance, 0)).toBeCloseTo(view.totalBalance, 6);
  });

  it('drops zero, negative and non-numeric balances', () => {
    const view = buildTokenHoldersView(
      'X',
      { holders: { a: 0, b: -1, c: NaN, d: 'oops' as unknown as number, e: 3 } },
      { holders: { a: 0 } },
      10
    );
    expect(view.top).toEqual([{ address: 'e', amount: 3, staked: 0 }]);
    expect(view.holdersCount).toBe(1);
  });

  it('accepts the empty object Hypurrscan returns for an unknown token', () => {
    const view = buildTokenHoldersView('X', {}, {}, 10);
    expect(view).toMatchObject({ holdersCount: 0, totalBalance: 0, top: [], lastUpdate: 0 });
    expect(view.cohorts.every((c) => c.count === 0)).toBe(true);
  });

  it('treats a "__proto__" address as a plain key', () => {
    const spot = JSON.parse('{"holders":{"__proto__":4,"a":1}}');
    const view = buildTokenHoldersView('X', spot, {}, 10);
    expect(view.top.map((r) => r.address)).toEqual(['__proto__', 'a']);
  });
});
