import {
  LedgerUpdate,
  RY_ASSISTANCE_FUND,
  RY_INTEREST_ADDRESS,
  bucketReserveYieldByDay,
} from '../../../src/services/revenue/reserve-yield.ledger';

const PAYER = '0x8536000000000000000000000000000000000000';

function send(iso: string, from: string, to: string, amount: string, token = 'USDC'): LedgerUpdate {
  return { time: Date.parse(iso), hash: '0x01', delta: { type: 'send', user: from, destination: to, token, amount } };
}

describe('bucketReserveYieldByDay', () => {
  it('books payments into the interest address on the UTC day they landed', () => {
    const daily = bucketReserveYieldByDay([
      send('2026-10-03T02:43:00Z', PAYER, RY_INTEREST_ADDRESS, '14580777.21'),
      send('2026-11-02T23:59:00Z', PAYER, RY_INTEREST_ADDRESS, '15000000'),
    ]);
    expect(daily.get('2026-10-03')).toBeCloseTo(14_580_777.21, 2);
    expect(daily.get('2026-11-02')).toBe(15_000_000);
  });

  it('ignores test sends, the forward to the fund and other tokens', () => {
    const daily = bucketReserveYieldByDay([
      send('2026-08-27T18:34:00Z', PAYER, RY_INTEREST_ADDRESS, '1'),
      send('2026-10-03T00:00:00Z', RY_INTEREST_ADDRESS, RY_ASSISTANCE_FUND, '14580777.21'),
      send('2026-10-03T05:00:00Z', PAYER, RY_INTEREST_ADDRESS, '5000', 'HYPE'),
      { time: Date.parse('2026-10-03T06:00:00Z'), hash: '0x02', delta: { type: 'deposit', amount: '5000' } },
    ]);
    expect(daily.size).toBe(0);
  });
});
