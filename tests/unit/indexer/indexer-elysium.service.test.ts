import { IndexerElysiumService } from '../../../src/services/indexer/indexer-elysium.service';
import { cacheService } from '../../../src/core/cache.service';
import { HypeDexerElysiumIndexerClient } from '../../../src/clients/hypedexer/rest/elysium/elysium-indexer.client';
import { HYPEDEXER_TTL } from '../../../src/constants/hypedexer.cache';

jest.mock('../../../src/core/cache.service', () => ({
  cacheService: { getOrSet: jest.fn() },
}));

jest.mock('../../../src/clients/hypedexer/rest/elysium/elysium-indexer.client', () => ({
  HypeDexerElysiumIndexerClient: { getInstance: jest.fn() },
}));

describe('IndexerElysiumService cache keys', () => {
  const client = {
    getStats: jest.fn().mockResolvedValue({ ok: 1 }),
    getBridgeTransfers: jest.fn().mockResolvedValue([]),
    getBridgeReserves: jest.fn().mockResolvedValue([]),
    getTransactions: jest.fn().mockResolvedValue([]),
  };
  const getOrSet = cacheService.getOrSet as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    (IndexerElysiumService as unknown as { instance?: IndexerElysiumService }).instance = undefined;
    (HypeDexerElysiumIndexerClient.getInstance as jest.Mock).mockReturnValue(client);
    getOrSet.mockImplementation((_key: string, fetcher: () => Promise<unknown>) => fetcher());
  });

  const keyOf = (call: number): string => getOrSet.mock.calls[call][0] as string;

  it('uses a fixed key and the configured TTL for /stats', async () => {
    await IndexerElysiumService.getInstance().getStats();
    expect(keyOf(0)).toBe('hypedexer:elysium:stats');
    expect(getOrSet.mock.calls[0][2]).toBe(HYPEDEXER_TTL.elysiumStats);
  });

  it('never caches filtered and unfiltered calls under the same key', async () => {
    const svc = IndexerElysiumService.getInstance();
    await svc.getBridgeTransfers({});
    await svc.getBridgeTransfers({ direction: 'deposit' });
    await svc.getBridgeTransfers({ direction: 'withdrawal' });
    await svc.getBridgeTransfers({ direction: 'deposit', limit: 5 });
    const keys = [0, 1, 2, 3].map(keyOf);
    expect(new Set(keys).size).toBe(4);
    expect(keys[1]).toContain('"direction":"deposit"');
  });

  it('builds the same key regardless of param order', async () => {
    const svc = IndexerElysiumService.getInstance();
    await svc.getBridgeTransfers({ direction: 'deposit', limit: 5 });
    await svc.getBridgeTransfers({ limit: 5, direction: 'deposit' });
    expect(keyOf(0)).toBe(keyOf(1));
  });

  it('includes route and boolean flags in the reserves / transactions keys', async () => {
    const svc = IndexerElysiumService.getInstance();
    await svc.getBridgeReserves({ route: 'native' });
    await svc.getBridgeReserves({ route: 'mirror' });
    await svc.getBridgeReserves({ route: 'native', only_unbacked: true });
    await svc.getTransactions({ include_spam: false });
    await svc.getTransactions({ include_spam: true });
    const keys = [0, 1, 2, 3, 4].map(keyOf);
    expect(new Set(keys).size).toBe(5);
    expect(client.getBridgeReserves).toHaveBeenCalledWith({ route: 'native', only_unbacked: true });
  });
});
