import { formatLiquidationAlert, formatFillAlert } from '../../../src/utils/telegram.formatting';
import { formatDocUpdateTelegramMessage, docPageTitle } from '../../../src/utils/telegram.doc-update';
import type { AggregatedLiquidation } from '../../../src/types/liquidations.types';
import type { AggregatedFill } from '../../../src/types/fill-alerts.types';

const liq = (o: Partial<AggregatedLiquidation> = {}): AggregatedLiquidation => ({
  time: '2026-10-03T14:03:21',
  time_ms: 0,
  coin: 'BTC',
  hash: '0xabc',
  liquidated_user: '0x1234567890ABCDEF1234567890abcdef12345678',
  size_total: 14.8,
  notional_total: 1_250_000,
  fill_px_vwap: 84_512,
  mark_px: 84_530,
  method: 'market',
  fee_total_liquidated: 0,
  liquidators: [],
  liquidator_count: 1,
  liq_dir: 'Long',
  tid: 1,
  ...o,
});

describe('alert messages share one shape', () => {
  it('liquidation: event and amount first, alert name, wallet link, no raw hash dump', () => {
    const m = formatLiquidationAlert(liq(), 'Big Liquidations');
    const lines = m.split('\n');
    expect(lines[0]).toBe('🟥 <b>BTC long liquidated · $1.25M</b>');
    expect(lines[1]).toBe('<i>Big Liquidations</i>');
    expect(m).toContain('14.8 BTC closed at $84,512.00');
    expect(m).toContain('/market/tracker/wallet/0x1234567890abcdef1234567890abcdef12345678');
    expect(m).toContain('14:03:21 UTC');
    expect(m).not.toContain('<code>0xabc</code>');
    expect(m).not.toMatch(/agrég/);
    expect(m).not.toContain('—');
  });

  it('liquidation: a liquidated short is green, aggregation is spelled out', () => {
    const m = formatLiquidationAlert(
      liq({
        liq_dir: 'Short',
        aggregation: {
          isAggregated: true,
          count: 3,
          timeRangeMs: [0, 12_000],
          originalTids: [],
          totalNotional: 1_250_000,
          totalSize: 20,
          avgMarkPrice: 0,
          avgFillPrice: 0,
          uniqueLiquidators: [],
        },
      })
    );
    expect(m.split('\n')[0]).toBe('🟩 <b>BTC short liquidated · $1.25M</b>');
    expect(m).toContain('3 liquidations of this wallet in 12s');
  });

  it('fill: side, size, coin and notional in the headline, then the alert name', () => {
    const fill = {
      coin: 'ETH',
      side: 'B',
      px: 3296.4,
      sz: 12.5,
      notionalUsd: 41_205,
      wallet: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      hash: '0xfeed',
      time: 1_790_000_000_000,
      source: 'perp',
      dir: 'Open Long',
      fillCount: 4,
      aggregationDurationMs: 2000,
      closedPnlTotal: 0,
      twapId: null,
    } as unknown as AggregatedFill;
    const m = formatFillAlert(fill, 'Whale Fills', { walletLabel: 'Fund A' });
    expect(m.split('\n')[0]).toBe('🟢 <b>Buy 12.5 ETH · $41.2K</b>');
    expect(m.split('\n')[1]).toBe('<i>Whale Fills</i>');
    expect(m).toContain('4 fills in 2s');
    expect(m).toContain('<b>Fund A</b>');
  });

  it('doc update: readable page titles, added and removed lines', () => {
    expect(docPageTitle('for-developers/api/exchange-endpoint')).toBe('For developers › API › Exchange endpoint');
    const m = formatDocUpdateTelegramMessage([
      {
        relPath: 'trading/fees',
        pageUrl: 'https://hyperliquid.gitbook.io/hyperliquid-docs/trading/fees',
        oldContent: 'The maker fee is 0.015% for the base tier of volume.',
        newContent: 'The maker fee is 0.010% for the base tier of volume.',
      },
    ]);
    expect(m.split('\n')[0]).toBe('📚 <b>Hyperliquid docs changed · 1 page</b>');
    expect(m).toContain('<b>Trading › Fees</b>');
    expect(m).toContain('➕ The maker fee is 0.010%');
    expect(m).toContain('➖ The maker fee is 0.015%');
    expect(m).not.toContain('Manage alerts');
  });
});
