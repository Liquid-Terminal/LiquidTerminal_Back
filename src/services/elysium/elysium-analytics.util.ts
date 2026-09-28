/**
 * Pure helpers for the Elysium analytics routes (day series, precompile
 * labels, retention math). No I/O so they stay unit-testable.
 */

const DAY_MS = 86_400_000;

/** Arbitrum Nitro precompiles and well-known system addresses (by low byte). */
const PRECOMPILE_LABELS: Record<number, string> = {
  0x64: 'ArbSys',
  0x65: 'ArbInfo',
  0x66: 'ArbAddressTable',
  0x68: 'ArbAggregator',
  0x69: 'ArbStatistics',
  0x6b: 'ArbOwnerPublic',
  0x6c: 'ArbGasInfo',
  0x6e: 'ArbRetryableTx',
  0x70: 'ArbOwner',
  0xc8: 'NodeInterface',
};

const PRECOMPILE_RE = /^0x0{38}([0-9a-f]{2})$/i;

/** SQL LIKE pattern matching 0x0000…00XX addresses. */
export const PRECOMPILE_LIKE = `0x${'0'.repeat(38)}__`;

/** Label for a 0x0000…00XX address, or null when it is not a precompile. */
export function precompileLabel(address: string): string | null {
  const m = PRECOMPILE_RE.exec(address);
  if (!m) return null;
  return PRECOMPILE_LABELS[parseInt(m[1], 16)] ?? 'Precompile';
}

/** UTC midnight of the given date. */
export function utcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Day keys (YYYY-MM-DD, ascending) of the last `days` UTC days, today included. */
export function lastDays(now: Date, days: number): string[] {
  const today = utcMidnight(now).getTime();
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(dayKey(new Date(today - i * DAY_MS)));
  return out;
}

/** Normalises a DB date/timestamp/day string to a YYYY-MM-DD key. */
export function toDayKey(v: Date | string): string {
  return typeof v === 'string' ? v.slice(0, 10) : dayKey(v);
}

/**
 * Builds one row per day in `dayKeys` (zero-filled from `zero`), merging the
 * DB rows keyed by day, and flags today's row as partial.
 */
export function fillDays<T extends object>(
  dayKeys: string[],
  rows: Map<string, T>,
  zero: () => T,
  now: Date
): Array<{ day: string; partial: boolean } & T> {
  const today = dayKey(now);
  return dayKeys.map((day) => ({ day, partial: day === today, ...(rows.get(day) ?? zero()) }));
}

/**
 * Retention fraction for cohort `cohortDay` at `offsetDays`, or null while the
 * offset day is not complete yet (it must end before `now`).
 */
export function retentionFraction(
  cohortDay: string,
  offsetDays: number,
  size: number,
  retained: number,
  now: Date
): number | null {
  const offsetDayEnd = new Date(`${cohortDay}T00:00:00Z`).getTime() + (offsetDays + 1) * DAY_MS;
  if (offsetDayEnd > now.getTime()) return null;
  if (size <= 0) return null;
  return retained / size;
}

/** Share of `part` in `total`, 0 when total is 0. */
export function share(part: number, total: number): number {
  return total > 0 ? part / total : 0;
}
