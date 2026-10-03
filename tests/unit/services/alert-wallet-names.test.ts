const primaryNames = jest.fn();
jest.mock('../../../src/clients/hlnames/hlnames.client', () => ({
  HlNamesClient: { getInstance: () => ({ primaryNames }) },
}));

import { prefetchWalletNames, walletName } from '../../../src/services/names/alert-wallet-names';
import { formatLiquidationAlert } from '../../../src/utils/telegram.formatting';
import type { AggregatedLiquidation } from '../../../src/types/liquidations.types';

const W = '0x1234567890abcdef1234567890abcdef12345678';

const liq = (user: string): AggregatedLiquidation => ({
  time: '2026-10-03T14:03:21',
  time_ms: 0,
  coin: 'BTC',
  hash: '0xabc',
  liquidated_user: user,
  size_total: 1,
  notional_total: 100_000,
  fill_px_vwap: 84_512,
  mark_px: 84_530,
  method: 'market',
  fee_total_liquidated: 0,
  liquidators: [],
  liquidator_count: 1,
  liq_dir: 'Long',
  tid: 1,
});

describe('wallet .hl names in alerts', () => {
  beforeEach(() => primaryNames.mockReset());

  it('shows the .hl name once prefetched, looked up once per wallet', async () => {
    primaryNames.mockResolvedValue({ [W]: 'testooor.hl' });
    await prefetchWalletNames([W.toUpperCase().replace('0X', '0x'), W]);
    await prefetchWalletNames([W]);
    expect(primaryNames).toHaveBeenCalledTimes(1);
    expect(walletName(W)).toBe('testooor.hl');
    expect(formatLiquidationAlert(liq(W))).toContain('<b>testooor.hl</b>');
  });

  it('falls back to the short address when the name service is down', async () => {
    const other = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    primaryNames.mockRejectedValue(new Error('down'));
    await prefetchWalletNames([other]);
    expect(walletName(other)).toBeNull();
    expect(formatLiquidationAlert(liq(other))).toContain('0xaaaa…aaaa');
  });
});
