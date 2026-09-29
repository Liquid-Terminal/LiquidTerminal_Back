import {
  enrichMarkets,
  enrichSettlements,
  type RawHip4Market,
} from '../../../src/utils/hip4-enrichment.util';

/** A raw `/hip4/markets` row as HypeDexer sends it today (2026-09). */
function row(fields: Partial<RawHip4Market> & { outcome_id: number }): RawHip4Market {
  return {
    question_id: null,
    coin: `#${fields.outcome_id}`,
    class: '',
    underlying: '',
    name: '',
    description: '',
    side_specs: '[{"name":"Yes"},{"name":"No"}]',
    settled: 0,
    block_time: '2026-09-27T06:05:52.299000',
    ...fields,
  };
}

// Raw outcome 6024 on 2026-09-29, trimmed.
const hype6024 = row({
  outcome_id: 6024,
  name: 'Recurring',
  description: 'class:priceBinary|underlying:HYPE|expiry:20260928-0600|targetPrice:93.017|period:1d',
  class: 'priceBinary',
  underlying: 'HYPE',
  expiry: '20260928-0600',
  target_price: 93.017,
  period: '1d',
  settled: 1,
  block_time: '2026-09-28T06:00:12.035000',
  total_volume: 22068.45,
});

describe('enrichMarkets — settlement state', () => {
  it('reads the settled flag HypeDexer sends, with the settlement time in UTC', () => {
    const [m] = enrichMarkets([hype6024], [], []);
    expect(m.is_settled).toBe(true);
    expect(m.settled_at).toBe('2026-09-28T06:00:12.035000Z');
  });

  it('leaves an open market unsettled, without a settlement time', () => {
    const [m] = enrichMarkets([{ ...hype6024, settled: 0 }], [], []);
    expect(m.is_settled).toBe(false);
    expect(m.settled_at).toBeNull();
  });

  it('keeps one row per outcome when a filtered read repeats it', () => {
    const rows = enrichMarkets([hype6024, hype6024, hype6024], [], []);
    expect(rows).toHaveLength(1);
  });
});

describe('enrichMarkets — each row is its own market', () => {
  // Rows 1 and 12 from the oldest list: 12 is a named outcome of bucket question 1.
  const btc1 = row({
    outcome_id: 1,
    name: 'Recurring',
    description: 'class:priceBinary|underlying:BTC|expiry:20260504-0600|targetPrice:78213|period:1d',
    class: 'priceBinary',
    underlying: 'BTC',
    expiry: '20260504-0600',
    target_price: 78213,
    period: '1d',
  });
  const bucket12 = row({ outcome_id: 12, question_id: 1, name: 'Recurring Named Outcome', description: 'index:0', target_price: 0 });

  it('does not fill a row from outcome floor(id / 10)', () => {
    const byId = new Map(enrichMarkets([btc1, bucket12], [], []).map((m) => [m.outcome_id, m]));
    expect(byId.get(12)).toMatchObject({ class: null, underlying: null, expiry: null, period: null });
    expect(byId.get(12)?.display_name).not.toMatch(/BTC above/);
    expect(byId.get(1)?.display_name).toBe('BTC above 78,213 on May 4 at 6:00 AM UTC?');
  });

  it('does not read a side from the last digit of a raw outcome id', () => {
    const [m] = enrichMarkets([{ ...btc1, outcome_id: 20, coin: '#20' }], [], []);
    expect(m.side).toBeNull();
    expect(m.short_name).toBe('BTC');
  });
});

describe('enrichSettlements — times', () => {
  it('sends the settlement time as UTC', () => {
    const [s] = enrichSettlements(
      [{ outcome_id: 6024, settle_fraction: 0, details: 'price:89.0163', block_time: '2026-09-28T06:00:14.527538' }],
      [],
      []
    );
    expect(s.settled_at).toBe('2026-09-28T06:00:14.527538Z');
    expect(s.settled_px).toBe(89.0163);
    expect(s.winner_side).toBe(1);
  });
});
