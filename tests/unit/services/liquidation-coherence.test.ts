import { isPriceCoherent } from '../../../src/services/liquidations/liquidations.ws.service';

describe('isPriceCoherent', () => {
  it('keeps a liquidation filled near its mark', () => {
    expect(isPriceCoherent({ fill_px_vwap: 85_299.6, mark_px: 85_290 })).toBe(true);
    expect(isPriceCoherent({ fill_px_vwap: null, mark_px: 85_290 })).toBe(true);
  });

  it('rejects a row that sums several coins under one name', () => {
    // Seen on 4 Oct 2026: 2,855,552 "BTC" closed at $0.11 with BTC marked at $85,290.
    expect(isPriceCoherent({ fill_px_vwap: 0.1099, mark_px: 85_290 })).toBe(false);
  });
});
