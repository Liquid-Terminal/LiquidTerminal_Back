jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import logger from '../../src/utils/logger';
import { logDeduplicator } from '../../src/utils/logDeduplicator';

/**
 * LogDeduplicator used to keep the last emission time of every key it saw —
 * keys embedding the JSON metadata — and leaked ~200 MB/day in production.
 * It now holds no state at all: every line goes to the logger, whose own
 * window (60 s per level:message, bounded map) absorbs the repeats; see
 * logger.dedup.test.ts.
 */
describe('LogDeduplicator', () => {
  beforeEach(() => {
    logDeduplicator.reset();
    jest.clearAllMocks();
  });

  it('forwards every line to the logger, at its level', async () => {
    await logDeduplicator.info('tick', { a: 1 });
    await logDeduplicator.info('tick', { a: 1 });
    await logDeduplicator.warn('careful', { b: 2 });
    await logDeduplicator.error('broken', {});
    await logDeduplicator.debug('noise');
    expect(logger.info).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith('tick', { a: 1 });
    expect(logger.warn).toHaveBeenCalledWith('careful', { b: 2 });
    expect(logger.error).toHaveBeenCalledWith('broken', {});
    expect(logger.debug).toHaveBeenCalledWith('noise', {});
  });

  it('keeps nothing per key, whatever the metadata', async () => {
    for (let i = 0; i < 50_010; i++) await logDeduplicator.debug('burst', { i });
    expect(logger.debug).toHaveBeenCalledTimes(50_010);
    const ownState = Object.values(logDeduplicator as unknown as Record<string, unknown>);
    expect(ownState.filter((v) => v instanceof Map || (typeof v === 'object' && v !== null))).toEqual([]);
  });
});
