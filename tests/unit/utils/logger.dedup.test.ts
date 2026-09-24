/**
 * The logger folds repeats of a level:message within a 60 s window. A warning
 * or error that keeps recurring must still produce a line per window (with
 * its occurrence count) — it used to be written once for the process
 * lifetime. Info and debug keep the quiet behaviour.
 */
import { LogDeduplicatorInternal } from '../../../src/utils/logger';

describe('logger deduplication', () => {
  let now: number;
  let dedup: LogDeduplicatorInternal;

  beforeEach(() => {
    now = 1_800_000_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    dedup = LogDeduplicatorInternal.getInstance();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** Logs `message` every `everyMs` for `forMs`; returns the written lines' counts. */
  function recur(level: string, message: string, everyMs: number, forMs: number): number[] {
    const written: number[] = [];
    for (let t = 0; t <= forMs; t += everyMs) {
      const entry = dedup.processLog(level, message, { t });
      if (entry) written.push(entry.count);
      now += everyMs;
    }
    return written;
  }

  it('writes a recurring error once per window with the occurrences it stands for', () => {
    // Every 30 s for 5 min: 11 occurrences.
    const written = recur('error', 'Poller failed', 30_000, 300_000);
    expect(written).toEqual([1, 2, 2, 2, 2, 2]);
    expect(written.reduce((a, b) => a + b, 0)).toBe(11);
  });

  it('does the same for warnings, carrying the latest metadata', () => {
    const first = dedup.processLog('warn', 'Upstream slow', { attempt: 1 });
    now += 20_000;
    expect(dedup.processLog('warn', 'Upstream slow', { attempt: 2 })).toBeNull();
    now += 40_000;
    const again = dedup.processLog('warn', 'Upstream slow', { attempt: 3 });
    expect(first?.count).toBe(1);
    expect(again?.count).toBe(2);
    expect(again?.metadata).toEqual({ attempt: 3 });
  });

  it('keeps info and debug quiet while they recur', () => {
    expect(recur('info', 'Poll done', 30_000, 300_000)).toEqual([1]);
    expect(recur('debug', 'Tick', 10_000, 300_000)).toEqual([1]);
  });

  it('writes a message again after a full window of silence', () => {
    expect(dedup.processLog('error', 'Rare failure')).not.toBeNull();
    now += 61_000;
    expect(dedup.processLog('error', 'Rare failure')?.count).toBe(1);
    expect(dedup.processLog('info', 'Rare info')).not.toBeNull();
    now += 61_000;
    expect(dedup.processLog('info', 'Rare info')).not.toBeNull();
  });
});
