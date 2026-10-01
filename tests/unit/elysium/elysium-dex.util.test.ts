import {
  decodePoolCreated,
  decodeSwap,
  DEX_TOPICS,
  methodName,
  pickSignature,
  wordInt,
} from '../../../src/services/elysium/elysium-dex.util';

/** Real Elysium testnet logs (upstream /logs), trimmed to the decoded fields. */
const v2Pair = {
  block_time: '2026-09-28T09:21:59',
  block_number: 581993,
  log_index: 0,
  tx_hash: '0xa359329d8fbb9eb77ef3374a89a7d40ed63a93738d9430c5c1630ca1f5b527fe',
  address: '0x16e2a1b953b2e1fc2a82f8e2d68a13884e18a2b9',
  topic0: DEX_TOPICS.v2PairCreated,
  topic1: '0x0000000000000000000000002ea3f3dc4bc12b9bc8e864ea4cadd7eb74d8c468',
  topic2: '0x0000000000000000000000007a77424e39af8f50d52ec190cbf82bca807287a3',
  topic3: '',
  data: '0x000000000000000000000000b094fe3558e1d3182143d040b02a7e2d803e20b50000000000000000000000000000000000000000000000000000000000000014',
};

const v3Pool = {
  block_time: '2026-09-26T05:25:44',
  block_number: 276111,
  log_index: 6,
  tx_hash: '0xf89abdf98eaecdf899a101a35659cd7c059819da874c9dc3d0f4f95f6ec1233e',
  address: '0x77573e627213afcfb5c2165940ce696fef2b4794',
  topic0: DEX_TOPICS.v3PoolCreated,
  topic1: '0x000000000000000000000000d123b9e4a8c0ea570e8d7bfdcc9c78f8483c8888',
  topic2: '0x000000000000000000000000d20b24f05930f114100d108a481c4ec022f40daa',
  topic3: '0x0000000000000000000000000000000000000000000000000000000000002710',
  data: '0x00000000000000000000000000000000000000000000000000000000000000c800000000000000000000000069e1843ec68394720a87e2fc9610ebe687df07c7',
};

const v2Swap = {
  block_time: '2026-09-28T09:04:40',
  block_number: 579265,
  log_index: 4,
  tx_hash: '0xce233c7422fa5d8dca89fa7feb0643460c36ed22a991a7f33ffe231689e1455c',
  address: '0x7062fdaabb95a25f3821539b4f8688dc5fc77356',
  topic0: DEX_TOPICS.v2Swap,
  topic1: '0x0000000000000000000000001e4f06e89a0c4f0c47f42a78881c8ee357dd628e',
  topic2: '0x000000000000000000000000b23e2d323e6fbd008618bf3970881107f2bfd580',
  topic3: '',
  data:
    '0x00000000000000000000000000000000000000000000000000235978e783e000' +
    '0000000000000000000000000000000000000000000000000000000000000000' +
    '0000000000000000000000000000000000000000000000000000000000000000' +
    '00000000000000000000000000000000000000000013d4e6067d4497721dcdf8',
};

const v3Swap = {
  block_time: '2026-09-27T21:13:42',
  block_number: 497432,
  log_index: 4,
  tx_hash: '0x734be7cd71c0c6560a54350f6d3640be8bdf94ebe8318defe3a2bdcd03a3b667',
  address: '0x8e1cad7799b8c7fecf51a4bbebf5022e0893d7e7',
  topic0: DEX_TOPICS.v3Swap,
  topic1: '0x000000000000000000000000c686baad619d0489814cdfcd527a7531ebd9b0c2',
  topic2: '0x000000000000000000000000b5be934c92341862fa9e1658cecb0848cc5a130c',
  topic3: '',
  data:
    '0x00000000000000000000000000000000000000000000000000b1a2bc2ec50000' +
    'ffffffffffffffffffffffffffffffffffffffffffffabe1036afeaa59daee73' +
    '0000000000000000000000000000000000000b100199f6fdf2d614dda73b0788' +
    '000000000000000000000000000000000000000000002fa333e017af62274ca6' +
    '0000000000000000000000000000000000000000000000000000000000026d06',
};

describe('decodePoolCreated', () => {
  it('decodes a V2 PairCreated (pair in data word 0)', () => {
    expect(decodePoolCreated(v2Pair)).toEqual({
      pool: '0xb094fe3558e1d3182143d040b02a7e2d803e20b5',
      factory: '0x16e2a1b953b2e1fc2a82f8e2d68a13884e18a2b9',
      version: 'v2',
      token0: '0x2ea3f3dc4bc12b9bc8e864ea4cadd7eb74d8c468',
      token1: '0x7a77424e39af8f50d52ec190cbf82bca807287a3',
      fee: null,
      created_at: '2026-09-28T09:21:59.000Z',
      block_number: '581993',
      tx_hash: v2Pair.tx_hash,
    });
  });

  it('decodes a V3 PoolCreated (fee in topic3, pool in data word 1)', () => {
    const r = decodePoolCreated(v3Pool);
    expect(r?.pool).toBe('0x69e1843ec68394720a87e2fc9610ebe687df07c7');
    expect(r?.fee).toBe(10000);
    expect(r?.version).toBe('v3');
  });

  it('rejects other topics and malformed rows', () => {
    expect(decodePoolCreated({ ...v2Pair, topic0: DEX_TOPICS.v2Swap })).toBeNull();
    expect(decodePoolCreated({ ...v2Pair, data: '0x' })).toBeNull();
    expect(decodePoolCreated({ ...v2Pair, topic1: '' })).toBeNull();
    expect(decodePoolCreated(null)).toBeNull();
  });
});

describe('decodeSwap', () => {
  it('nets V2 in/out amounts from the pool side', () => {
    const r = decodeSwap(v2Swap);
    expect(r).toMatchObject({
      pool: v2Swap.address,
      version: 'v2',
      log_index: 4,
      sender: '0x1e4f06e89a0c4f0c47f42a78881c8ee357dd628e',
      recipient: '0xb23e2d323e6fbd008618bf3970881107f2bfd580',
      amount0: '9950000000000000',
      amount1: '-23974975485788625863298552',
    });
  });

  it('reads V3 signed int256 amounts', () => {
    const r = decodeSwap(v3Swap);
    expect(r?.amount0).toBe('50000000000000000');
    expect(r?.amount1).toBe('-397250387338197943521677');
  });

  it('rejects truncated data', () => {
    expect(decodeSwap({ ...v2Swap, data: v2Swap.data.slice(0, 130) })).toBeNull();
  });
});

describe('helpers', () => {
  it('wordInt handles two complement', () => {
    expect(wordInt('f'.repeat(64))).toBe(BigInt(-1));
    expect(wordInt('0'.repeat(63) + '1')).toBe(BigInt(1));
  });

  it('pickSignature prefers a verified, unfiltered candidate', () => {
    expect(
      pickSignature([
        { name: 'watch_tg_invmru_89cb189(uint256,address)', filtered: false, hasVerifiedContract: false },
        { name: 'mint(address)', filtered: false, hasVerifiedContract: true },
      ])
    ).toBe('mint(address)');
    expect(pickSignature([{ name: 'foo()', filtered: true }, { name: 'bar()', filtered: false }])).toBe('bar()');
    expect(pickSignature([])).toBeNull();
  });

  it('pickSignature drops free text registered in public signature databases', () => {
    expect(pickSignature([{ name: 'claim at https://scam.xyz()', filtered: false }, { name: 'claim()', filtered: false }])).toBe('claim()');
    expect(pickSignature([{ name: `a(${'uint256,'.repeat(40)}uint256)`, filtered: false }])).toBeNull();
    expect(pickSignature([{ name: 'f(<img src=x>)', filtered: false }])).toBeNull();
    expect(pickSignature([{ name: 'swap((address,uint256)[],bytes)', filtered: false }])).toBe('swap((address,uint256)[],bytes)');
  });

  it('methodName strips the argument list', () => {
    expect(methodName('transfer(address,uint256)')).toBe('transfer');
    expect(methodName(null)).toBeNull();
  });
});
