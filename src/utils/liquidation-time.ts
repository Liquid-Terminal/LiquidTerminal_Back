/**
 * HypeDexer sometimes sends a liquidation's `time_ms` doubled — it lands around
 * the year 2083 — while its ISO `time` (UTC, second precision, no zone
 * designator) stays right. Such rows were stored in the future and counted in
 * every "since X" window.
 *
 * `time_ms` is kept when it agrees with `time` to the second (it carries the
 * milliseconds). A doubled one is halved when that agrees with `time` (the
 * doubling is exact, so the milliseconds survive); anything else falls back
 * to `time`.
 */
export function reliableLiquidationTimeMs(time: unknown, timeMs: number): number {
  if (typeof time !== 'string' || time.length === 0) return timeMs;
  const iso = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(time) ? time : `${time}Z`;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return timeMs;
  if (Math.abs(timeMs - parsed) < 1000) return timeMs;
  const halved = Math.floor(timeMs / 2);
  if (Math.abs(halved - parsed) < 1000) return halved;
  return parsed;
}
