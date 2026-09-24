import { reliableLiquidationTimeMs } from '../../../src/utils/liquidation-time';

describe('reliableLiquidationTimeMs', () => {
  // Real rows from HypeDexer (the ISO `time` is UTC without a zone designator).
  it('keeps a time_ms that agrees with the ISO time, milliseconds included', () => {
    expect(reliableLiquidationTimeMs('2026-09-24T09:14:46', 1790241286084)).toBe(1790241286084);
    expect(reliableLiquidationTimeMs('2026-09-24T09:14:46Z', 1790241286084)).toBe(1790241286084);
    expect(reliableLiquidationTimeMs('2026-09-24T11:14:46+02:00', 1790241286084)).toBe(1790241286084);
  });

  it('halves a doubled time_ms, keeping its milliseconds', () => {
    expect(reliableLiquidationTimeMs('2026-09-24T03:08:02', 3580438565358)).toBe(1790219282679);
    expect(reliableLiquidationTimeMs('2026-09-22T15:05:07', 3580179015240)).toBe(1790089507620);
  });

  it('falls back to the ISO time for any other disagreement', () => {
    expect(reliableLiquidationTimeMs('2026-09-24T03:08:02', 0)).toBe(1790219282000);
    expect(reliableLiquidationTimeMs('2026-09-24T03:08:02', Number.NaN)).toBe(1790219282000);
    expect(reliableLiquidationTimeMs('2026-09-24T03:08:02', 1790219282000 + 3_600_000)).toBe(1790219282000);
  });

  it('keeps time_ms when the ISO time is missing or unreadable', () => {
    expect(reliableLiquidationTimeMs(undefined, 1790241286084)).toBe(1790241286084);
    expect(reliableLiquidationTimeMs('', 1790241286084)).toBe(1790241286084);
    expect(reliableLiquidationTimeMs('not a date', 1790241286084)).toBe(1790241286084);
  });
});
