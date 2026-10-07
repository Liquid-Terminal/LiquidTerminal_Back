/**
 * A wallet's cache entries carry every filter that changes the upstream
 * answer: two callers asking different limits or coins for the same wallet
 * never read each other's rows.
 */
const mockStore = new Map<string, string>();
jest.mock('../../../src/core/redis.service', () => ({
  redisService: {
    get: jest.fn(async (key: string) => mockStore.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => {
      mockStore.set(key, value);
    }),
    delete: jest.fn(async () => undefined),
    getClient: () => ({ set: async () => 'OK' }),
    isHealthy: () => true,
  },
}));
jest.mock('../../../src/utils/logDeduplicator', () => ({
  logDeduplicator: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const usersClient = { getUserCoins: jest.fn(async (_u: string, p: { limit?: number }) => ({ limit: p.limit })) };
const fillsClient = {
  getUserFills: jest.fn(async (_u: string, p: { coin?: string }) => ({ coin: p.coin ?? 'all' })),
};
jest.mock('../../../src/clients/hypedexer/rest/users/users-indexer.client', () => ({
  HypeDexerUsersIndexerClient: { getInstance: () => usersClient },
}));
jest.mock('../../../src/clients/hypedexer/rest/fills/fills.client', () => ({
  HypeDexerFillsClient: { getInstance: () => fillsClient },
}));

import { HYPEDEXER_USER_CACHE_KEY } from '../../../src/constants/hypedexer.cache';
import { IndexerUsersService } from '../../../src/services/indexer/indexer-users.service';
import { IndexerFillsService } from '../../../src/services/indexer/indexer-fills.service';

const USER = '0x1111111111111111111111111111111111111111';

describe('user-scoped cache keys', () => {
  beforeEach(() => mockStore.clear());

  it('adds the filters, sorted, and drops the empty ones', () => {
    expect(HYPEDEXER_USER_CACHE_KEY.fills(USER)).toBe(`hypedexer:user:${USER}:fills`);
    expect(HYPEDEXER_USER_CACHE_KEY.fills(USER, { limit: undefined, coin: '' })).toBe(`hypedexer:user:${USER}:fills`);
    expect(HYPEDEXER_USER_CACHE_KEY.fills(USER, { limit: 50, coin: 'BTC' })).toBe(
      `hypedexer:user:${USER}:fills:coin=BTC&limit=50`
    );
    expect(HYPEDEXER_USER_CACHE_KEY.twaps(USER, { order: 'DESC', hours: 24 })).toBe(
      `hypedexer:user:${USER}:twaps:hours=24&order=DESC`
    );
  });

  it('answers each limit of a wallet’s coins with its own upstream call', async () => {
    const svc = IndexerUsersService.getInstance();
    await expect(svc.getUserCoins(USER, { limit: 8 })).resolves.toEqual({ limit: 8 });
    await expect(svc.getUserCoins(USER, { limit: 100 })).resolves.toEqual({ limit: 100 });
    await expect(svc.getUserCoins(USER, { limit: 8 })).resolves.toEqual({ limit: 8 });
    expect(usersClient.getUserCoins).toHaveBeenCalledTimes(2);
  });

  it('never serves a coin-filtered fills page to the unfiltered caller', async () => {
    const svc = IndexerFillsService.getInstance();
    await expect(svc.getUserFills(USER, { coin: 'BTC' })).resolves.toEqual({ coin: 'BTC' });
    await expect(svc.getUserFills(USER, {})).resolves.toEqual({ coin: 'all' });
  });
});
