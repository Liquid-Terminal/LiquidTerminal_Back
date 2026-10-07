/**
 * USDC reserve yield (aligned quote asset v2): the deployers of USDC pay the
 * protocol its share of the yield on the USDC reserves, once per 30-date
 * interval, into the system interest address for USDC, which forwards it to
 * the Assistance Fund. Read from that address's ledger
 * (`userNonFundingLedgerUpdates`), so it stays a pure function of its input.
 */
import { utcDateKey } from './revenue.daily';

/** System interest address for USDC (0x50..00 + token index 0) and the Assistance Fund. */
export const RY_INTEREST_ADDRESS = '0x5000000000000000000000000000000000000000';
export const RY_ASSISTANCE_FUND = '0xfefefefefefefefefefefefefefefefefefefefe';
/** Activation and test transfers (1 USDC) are not payments. */
export const RY_MIN_USDC = 1_000;
/** First funding of the interest address (27 Aug 2026), before which nothing was paid. */
export const RY_ACTIVATION_MS = Date.UTC(2026, 7, 27);

export interface LedgerUpdate {
  time: number;
  hash: string;
  delta: { type: string; user?: string; destination?: string; token?: string; amount?: string };
}

/** USDC that reached the interest address from outside, at least RY_MIN_USDC. */
export function isReserveYieldPayment(u: LedgerUpdate): boolean {
  if (u.delta.type !== 'send' || u.delta.token !== 'USDC') return false;
  const from = (u.delta.user ?? '').toLowerCase();
  const to = (u.delta.destination ?? '').toLowerCase();
  return to === RY_INTEREST_ADDRESS && from !== RY_INTEREST_ADDRESS && Number(u.delta.amount ?? 0) >= RY_MIN_USDC;
}

/**
 * Payments bucketed by the UTC day they landed. A payment covers a whole
 * 30-date interval but is booked on the day it is received, like the auction
 * proceeds, rather than spread over days that had not been paid for yet.
 */
export function bucketReserveYieldByDay(updates: LedgerUpdate[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const u of updates) {
    if (!isReserveYieldPayment(u)) continue;
    const key = utcDateKey(new Date(u.time));
    out.set(key, (out.get(key) ?? 0) + Number(u.delta.amount));
  }
  return out;
}
