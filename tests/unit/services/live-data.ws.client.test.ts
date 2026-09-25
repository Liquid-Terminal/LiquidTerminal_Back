/**
 * HypeDexer's `allFills` carries every fill since `fills_spot` was dropped:
 * spot pairs ("@107", "PURR/USDC") must come out as spot fills, every other
 * market (native, HIP-3 "dex:COIN", HIP-4 "#N") as perp fills, as before.
 */
import type { HypeDexerFill, NormalizedFill } from '../../../src/types/fill-alerts.types';

jest.mock('../../../src/utils/logDeduplicator', () => ({
  logDeduplicator: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { HypeDexerLiveDataWSClient } from '../../../src/clients/hypedexer/websocket/live-data.ws.client';

function fill(coin: string, overrides: Partial<HypeDexerFill> = {}): HypeDexerFill {
  return {
    coin,
    px: '2.5',
    sz: '4',
    side: 'B',
    time: 1_790_287_319_157,
    startPosition: '0.0',
    dir: 'Open Long',
    closedPnl: '1.25',
    hash: '0xhash',
    oid: 42,
    crossed: true,
    fee: '0.01',
    tid: 7,
    feeToken: 'USDC',
    twapId: null,
    ...overrides,
  };
}

describe('HypeDexerLiveDataWSClient allFills normalization', () => {
  const client = HypeDexerLiveDataWSClient.getInstance();
  const received: NormalizedFill[] = [];
  const unsubscribe = client.onFill((fills) => received.push(...fills));
  const deliver = (event: unknown): void =>
    (client as unknown as { onMessage(data: unknown): void }).onMessage(event);

  beforeEach(() => {
    received.length = 0;
  });

  afterAll(() => unsubscribe());

  it('tells spot fills apart from perp-like fills', () => {
    deliver({
      channel: 'allFills',
      data: {
        fills: [
          { address: '0xAAA', fill: fill('BTC') },
          { address: '0xBBB', fill: fill('xyz:GOLD', { dir: 'Close Short', closedPnl: 'oops' }) },
          { address: '0xCCC', fill: fill('#45931', { dir: 'Buy' }) },
          { address: '0xDDD', fill: fill('@107', { dir: 'Sell', side: 'A', twapId: 99 }) },
          { address: '0xEEE', fill: fill('PURR/USDC', { dir: 'Buy' }) },
        ],
      },
    });

    const common = { oid: 42, px: 2.5, sz: 4, notionalUsd: 10, time: 1_790_287_319_157, hash: '0xhash' };
    expect(received).toEqual([
      { source: 'perp', ...common, wallet: '0xaaa', coin: 'BTC', side: 'B', twapId: null, dir: 'Open Long', closedPnl: 1.25 },
      { source: 'perp', ...common, wallet: '0xbbb', coin: 'xyz:GOLD', side: 'B', twapId: null, dir: 'Close Short', closedPnl: 0 },
      { source: 'perp', ...common, wallet: '0xccc', coin: '#45931', side: 'B', twapId: null, dir: 'Buy', closedPnl: 1.25 },
      // Spot: no direction and no realized PnL on alerts; the pair id is resolved by the dispatcher.
      { source: 'spot', ...common, wallet: '0xddd', coin: '@107', side: 'A', twapId: 99 },
      { source: 'spot', ...common, wallet: '0xeee', coin: 'PURR/USDC', side: 'B', twapId: null },
    ]);
  });

  it('skips the snapshot replayed on subscribe', () => {
    deliver({ channel: 'allFills', data: { isSnapshot: true, fills: [{ address: '0xAAA', fill: fill('@107') }] } });
    expect(received).toEqual([]);
  });
});
