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

describe('liquidation and fill alerts keep their original layout', () => {
  it('liquidation: header, coin and amount, mark price, transaction and wallet blocks', () => {
    const m = formatLiquidationAlert(liq(), 'Big Liquidations');
    expect(m.split('\n')[0]).toBe('🚨 <b>LIQUIDATION ALERT</b>');
    expect(m).toContain('🟢 <b>BTC</b> Long: $1.25M');
    expect(m).toContain('Mark Price:');
    expect(m).toContain('<code>0xabc</code>');
    expect(m).toContain('<code>0x1234567890ABCDEF1234567890abcdef12345678</code>');
  });

  it('fill: header with the alert name, side, notional, size and wallet', () => {
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
    expect(m.split('\n')[0]).toBe('💸 <b>FILL ALERT</b> <code>PERP</code> · <i>Whale Fills</i>');
    expect(m).toContain('🟢 <b>ETH</b> BUY');
    expect(m).toContain('Filled in 4 fills (2s)');
    expect(m).toContain('<b>Fund A</b>');
  });
});

describe('doc update alerts', () => {
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
