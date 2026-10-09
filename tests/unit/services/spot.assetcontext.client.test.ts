/**
 * The spot poller turns Hyperliquid `spotMetaAndAssetCtxs` into the rows served
 * by `/market/spot` (Redis `spot:markets`):
 * - one row per pair of the universe, its context matched by coin name (the
 *   contexts also list pairs the universe leaves out, so positions differ);
 * - the quote token is named (most pairs are quoted in USDC, not all);
 * - pairs without a context or a base token are left out, rows sorted by
 *   24h volume, largest first.
 */
const mockRedis = {
  set: jest.fn<Promise<unknown>, [string, string]>(),
  publish: jest.fn<Promise<unknown>, [string, string]>(),
};

jest.mock('../../../src/core/redis.service', () => ({ redisService: mockRedis }));
jest.mock('../../../src/utils/logDeduplicator', () => ({
  logDeduplicator: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const token = (name: string, index: number, tokenId: string): Record<string, unknown> => ({
  name,
  szDecimals: 2,
  weiDecimals: 8,
  index,
  tokenId,
  isCanonical: false,
  evmContract: null,
  fullName: null,
});

const ctx = (coin: string, markPx: string, dayNtlVlm: string, circulatingSupply: string): Record<string, unknown> => ({
  coin,
  markPx,
  midPx: markPx,
  prevDayPx: '80.0',
  dayNtlVlm,
  circulatingSupply,
});

const HYPE_ID = '0x0d01dc56dcaaca66ad901c959b4011ec';
const UBTC_ID = '0x8f254b963e8468305d409b33aa137c67';

const SPOT_META = {
  tokens: [
    token('USDC', 0, '0x6d1e7cde53ba9467b783cb7c530ce054'),
    token('PURR', 1, '0xc1fb593aeffbeb02f85e0308e9956a90'),
    token('HYPE', 150, HYPE_ID),
    token('UBTC', 197, UBTC_ID),
    token('USDE', 235, '0x2e6d84f2d7ca82e6581e03523e4389f7'),
    token('USDT0', 268, '0x25faedc3f054130dbb4e4203aca63567'),
    token('USDH', 360, '0x54e00a5988577cb0b0c9ab0cb6ef7f4b'),
  ],
  universe: [
    { name: 'PURR/USDC', tokens: [1, 0], index: 0, isCanonical: true },
    { name: '@107', tokens: [150, 0], index: 107, isCanonical: false },
    { name: '@142', tokens: [197, 0], index: 142, isCanonical: false },
    { name: '@207', tokens: [150, 268], index: 207, isCanonical: false },
    { name: '@232', tokens: [150, 360], index: 232, isCanonical: false },
    { name: '@255', tokens: [150, 235], index: 255, isCanonical: false },
    { name: '@300', tokens: [999, 0], index: 300, isCanonical: false }, // base token unknown
    { name: '@301', tokens: [1, 998], index: 301, isCanonical: false }, // quote token unknown
    { name: '@302', tokens: [1, 0], index: 302, isCanonical: false }, // no context
  ],
};

// Listed by market index, with pairs the universe leaves out in between.
const CONTEXTS = [
  ctx('PURR/USDC', '0.12168', '3193004.93', '594769469.81'),
  ctx('@71', '1.0', '999999999.0', '1.0'),
  ctx('@107', '85.794', '101934882.87', '302165564.64'),
  ctx('@142', '82483.0', '44631926.92', '20999999.99'),
  ctx('@149', '2.0', '888888888.0', '1.0'),
  ctx('@207', '85.827', '89206.31', '302165564.64'),
  ctx('@232', '63.129', '0.0', '302165564.64'),
  ctx('@255', '85.822', '27302.78', '302165564.64'),
  ctx('@300', '5.0', '100.0', '1.0'),
  ctx('@301', '0.5', '50.0', '10.0'),
];

const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

interface Row {
  name: string;
  logo: string | null;
  price: number;
  marketCap: number;
  volume: number;
  change24h: number;
  liquidity: number;
  supply: number;
  marketIndex: number;
  tokenId: string;
  quote: string;
}

describe('HyperliquidSpotClient poll', () => {
  let rows: Row[];

  beforeAll(async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.publish.mockResolvedValue(1);
    const { HyperliquidSpotClient } = require('../../../src/clients/hyperliquid/spot/spot.assetcontext.client');
    const client = HyperliquidSpotClient.getInstance();
    jest.spyOn(client, 'post').mockResolvedValue([SPOT_META, CONTEXTS]);
    client.startPolling();
    await flush();
    const write = mockRedis.set.mock.calls.find(([key]) => key === 'spot:markets');
    if (!write) throw new Error('spot:markets was not written');
    rows = JSON.parse(write[1]) as Row[];
  });

  afterAll(() => jest.useRealTimers());

  const row = (marketIndex: number): Row | undefined => rows.find((r) => r.marketIndex === marketIndex);

  it('names the quote token of each pair', () => {
    expect(rows.map((r) => [r.marketIndex, r.quote])).toEqual(
      expect.arrayContaining([
        [0, 'USDC'],
        [107, 'USDC'],
        [142, 'USDC'],
        [207, 'USDT0'],
        [232, 'USDH'],
        [255, 'USDE'],
      ])
    );
  });

  it('reads an unknown quote token as USDC', () => {
    expect(row(301)?.quote).toBe('USDC');
  });

  it('matches each pair with the context of its coin, not of its position', () => {
    expect(row(107)).toMatchObject({ price: 85.794, volume: 101934882.87, supply: 302165564.64 });
    expect(row(232)).toMatchObject({ price: 63.129, volume: 0, supply: 302165564.64 });
    expect(row(301)).toMatchObject({ price: 0.5, volume: 50, supply: 10 });
  });

  it('serves the other fields as before', () => {
    expect(row(142)).toEqual({
      name: 'BTC',
      logo: 'https://app.hyperliquid.xyz/coins/BTC_USDC.svg',
      price: 82483,
      marketCap: 82483 * 20999999.99,
      volume: 44631926.92,
      change24h: Number((((82483 - 80) / 80) * 100).toFixed(2)),
      liquidity: 82483,
      supply: 20999999.99,
      marketIndex: 142,
      tokenId: UBTC_ID,
      quote: 'USDC',
    });
  });

  it('leaves out pairs without a base token or a context, and sorts by 24h volume', () => {
    expect(rows.map((r) => r.marketIndex)).toEqual([107, 142, 0, 207, 255, 301, 232]);
  });
});
