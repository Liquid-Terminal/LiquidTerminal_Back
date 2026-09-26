jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import logger from '../../src/utils/logger';
import { logDeduplicator } from '../../src/utils/logDeduplicator';

describe('LogDeduplicator', () => {
  beforeEach(() => {
    logDeduplicator.reset();
    jest.clearAllMocks();
  });

  it('still suppresses an identical line inside the throttle window', async () => {
    await logDeduplicator.info('tick', { a: 1 });
    await logDeduplicator.info('tick', { a: 1 });
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it('does not keep keys once their window has elapsed', async () => {
    const t0 = 1_000_000;
    const spy = jest.spyOn(Date, 'now').mockReturnValue(t0);
    for (let i = 0; i < 500; i++) await logDeduplicator.info('poll', { timestamp: t0 + i });
    expect(logDeduplicator.size()).toBe(500);

    spy.mockReturnValue(t0 + 5_000);
    (logDeduplicator as unknown as { prune: () => void }).prune();
    expect(logDeduplicator.size()).toBe(0);
    spy.mockRestore();
  });

  it('never grows past its hard cap', async () => {
    const spy = jest.spyOn(Date, 'now').mockReturnValue(2_000_000);
    for (let i = 0; i < 50_010; i++) await logDeduplicator.debug('burst', { i });
    expect(logDeduplicator.size()).toBeLessThanOrEqual(50_000);
    spy.mockRestore();
  });
});
