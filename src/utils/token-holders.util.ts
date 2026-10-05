/** Hypurrscan `/holders/{token}` (and `/holders/staked{token}`) payload. */
export interface RawTokenHolders {
  token?: string;
  /** Seconds since epoch. */
  lastUpdate?: number;
  holdersCount?: number;
  holders?: Record<string, number>;
}

export interface TokenHolderRow {
  address: string;
  /** Spot balance plus staked balance. */
  amount: number;
  /** Staked part of `amount` (0 when the address stakes nothing). */
  staked: number;
}

export interface HolderCohort {
  label: string;
  /** Smallest balance in the tier. */
  min: number;
  count: number;
  balance: number;
}

export interface TokenHoldersView {
  token: string;
  /** Latest Hypurrscan regeneration of the two lists, in seconds. */
  lastUpdate: number;
  /** Distinct addresses with a positive balance. */
  holdersCount: number;
  /** Summed balance of every holder. */
  totalBalance: number;
  /** Largest holders first, at most `maxRows`. */
  top: TokenHolderRow[];
  /** Whale → retail, every holder counted. */
  cohorts: HolderCohort[];
}

/**
 * Balance tiers, matched top-down (the first threshold a balance clears wins).
 * Sized for HYPE, the only token whose cohorts are shown.
 */
export const HOLDER_TIERS: ReadonlyArray<{ label: string; min: number }> = [
  { label: 'Whale', min: 100_000 },
  { label: 'Shark', min: 10_000 },
  { label: 'Dolphin', min: 1_000 },
  { label: 'Fish', min: 100 },
  { label: 'Shrimp', min: 0 },
];

const hasOwn = (record: Record<string, number>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, key);

/**
 * Keeps the `size` largest rows seen, in a min-heap on `amount`: once full,
 * most rows lose a single comparison against the root, so selecting the top
 * 10k of USDC's ~1M holders never sorts the whole list.
 */
class TopRows {
  private readonly heap: TokenHolderRow[] = [];

  constructor(private readonly size: number) {}

  push(row: TokenHolderRow): void {
    if (this.size <= 0) return;
    const heap = this.heap;
    if (heap.length < this.size) {
      heap.push(row);
      this.up(heap.length - 1);
    } else if (row.amount > heap[0].amount) {
      heap[0] = row;
      this.down(0);
    }
  }

  sortedDesc(): TokenHolderRow[] {
    return this.heap.slice().sort((a, b) => b.amount - a.amount);
  }

  private up(i: number): void {
    const heap = this.heap;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent].amount <= heap[i].amount) return;
      [heap[parent], heap[i]] = [heap[i], heap[parent]];
      i = parent;
    }
  }

  private down(i: number): void {
    const heap = this.heap;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let smallest = i;
      if (left < heap.length && heap[left].amount < heap[smallest].amount) smallest = left;
      if (right < heap.length && heap[right].amount < heap[smallest].amount) smallest = right;
      if (smallest === i) return;
      [heap[smallest], heap[i]] = [heap[i], heap[smallest]];
      i = smallest;
    }
  }
}

/**
 * Folds a token's spot and staked holder lists into one view.
 *
 * An address present in both lists holds the SUM of its two balances (about a
 * fifth of HYPE's stakers also hold spot HYPE); merging the maps used to let
 * the staked balance overwrite the spot one and counted the address twice.
 * Non-finite and non-positive balances are dropped.
 */
export function buildTokenHoldersView(
  token: string,
  spot: RawTokenHolders,
  staked: RawTokenHolders,
  maxRows: number
): TokenHoldersView {
  const spotHolders = spot.holders ?? {};
  const stakedHolders = staked.holders ?? {};

  const top = new TopRows(maxRows);
  const counts = HOLDER_TIERS.map(() => 0);
  const balances = HOLDER_TIERS.map(() => 0);
  let holdersCount = 0;
  let totalBalance = 0;

  const add = (address: string, spotAmount: number, stakedAmount: number): void => {
    const amount = spotAmount + stakedAmount;
    if (!Number.isFinite(amount) || amount <= 0) return;

    holdersCount += 1;
    totalBalance += amount;
    const tier = HOLDER_TIERS.findIndex((t) => amount >= t.min);
    counts[tier] += 1;
    balances[tier] += amount;
    top.push({ address, amount, staked: stakedAmount });
  };

  const amountOf = (value: unknown): number => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  for (const address of Object.keys(spotHolders)) {
    const stakedAmount = hasOwn(stakedHolders, address) ? amountOf(stakedHolders[address]) : 0;
    add(address, amountOf(spotHolders[address]), stakedAmount);
  }
  for (const address of Object.keys(stakedHolders)) {
    if (hasOwn(spotHolders, address)) continue;
    add(address, 0, amountOf(stakedHolders[address]));
  }

  return {
    token,
    lastUpdate: Math.max(spot.lastUpdate || 0, staked.lastUpdate || 0),
    holdersCount,
    totalBalance,
    top: top.sortedDesc(),
    cohorts: HOLDER_TIERS.map((tier, i) => ({
      label: tier.label,
      min: tier.min,
      count: counts[i],
      balance: balances[i],
    })),
  };
}
