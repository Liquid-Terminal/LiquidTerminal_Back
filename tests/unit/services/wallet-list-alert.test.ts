const findManyAlerts = jest.fn();
const findUniqueList = jest.fn();
const findFirstTgUser = jest.fn();

jest.mock('../../../src/core/prisma.service', () => ({
  prisma: {
    walletListAlert: { findMany: (...a: unknown[]) => findManyAlerts(...a) },
    walletList: { findUnique: (...a: unknown[]) => findUniqueList(...a) },
  },
}));
jest.mock('../../../src/core/prisma.telegram.service', () => ({
  prismaTelegram: { telegramUser: { findFirst: (...a: unknown[]) => findFirstTgUser(...a) } },
}));
jest.mock('../../../src/utils/logDeduplicator', () => ({
  logDeduplicator: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import {
  WalletListAlertService,
  TelegramNotLinkedForAlertsError,
  EmptyListAlertError,
} from '../../../src/services/telegram/wallet-list-alert.service';

const item = (address: string, name: string | null = null) => ({ userWallet: { name, Wallet: { address } } });
const row = (sub: string, userId: number, list: { userId: number; isPublic: boolean; items: unknown[] }) => ({
  fillSubscriptionId: sub,
  userId,
  walletListId: 7,
  walletList: { id: 7, name: 'Whales', ...list },
});

describe('WalletListAlertService.resolve', () => {
  const svc = WalletListAlertService.getInstance();
  beforeEach(() => jest.resetAllMocks());

  it('returns the live list wallets, lowercased and deduplicated, with labels', async () => {
    findManyAlerts.mockResolvedValue([
      row('s1', 1, { userId: 1, isPublic: false, items: [item('0xAbC', 'Desk'), item('0xabc'), item('0xdef')] }),
    ]);
    const out = await svc.resolve([{ id: 's1', linkedUserId: 1 }]);
    expect(out.get('s1')).toEqual({ walletListId: 7, wallets: ['0xabc', '0xdef'], labels: { '0xabc': 'Desk' } });
  });

  it('leaves subscriptions that follow no list untouched', async () => {
    findManyAlerts.mockResolvedValue([]);
    const out = await svc.resolve([{ id: 'plain', linkedUserId: 1 }]);
    expect(out.has('plain')).toBe(false);
  });

  it('silences an empty list instead of matching every wallet', async () => {
    findManyAlerts.mockResolvedValue([row('s1', 1, { userId: 1, isPublic: false, items: [] })]);
    expect((await svc.resolve([{ id: 's1', linkedUserId: 1 }])).get('s1')).toBeNull();
  });

  it('silences the alert once Telegram is unlinked from its owner', async () => {
    findManyAlerts.mockResolvedValue([row('s1', 1, { userId: 1, isPublic: false, items: [item('0x1')] })]);
    expect((await svc.resolve([{ id: 's1', linkedUserId: null }])).get('s1')).toBeNull();
    expect((await svc.resolve([{ id: 's1', linkedUserId: 2 }])).get('s1')).toBeNull();
  });

  it('follows a public list of someone else, and stops when it goes private', async () => {
    findManyAlerts.mockResolvedValueOnce([row('s1', 2, { userId: 1, isPublic: true, items: [item('0x1')] })]);
    expect((await svc.resolve([{ id: 's1', linkedUserId: 2 }])).get('s1')?.wallets).toEqual(['0x1']);
    findManyAlerts.mockResolvedValueOnce([row('s1', 2, { userId: 1, isPublic: false, items: [item('0x1')] })]);
    expect((await svc.resolve([{ id: 's1', linkedUserId: 2 }])).get('s1')).toBeNull();
  });
});

describe('WalletListAlertService.upsert guards', () => {
  const svc = WalletListAlertService.getInstance();
  const settings = { minUsd: 0, direction: null, source: null, isActive: true };
  beforeEach(() => jest.resetAllMocks());

  it('requires a linked Telegram account', async () => {
    findFirstTgUser.mockResolvedValue(null);
    await expect(svc.upsert(1, 7, settings)).rejects.toBeInstanceOf(TelegramNotLinkedForAlertsError);
  });

  it('refuses an empty list', async () => {
    findFirstTgUser.mockResolvedValue({ id: 'tg1' });
    findUniqueList.mockResolvedValue({ id: 7, name: 'x', userId: 1, isPublic: false, items: [] });
    await expect(svc.upsert(1, 7, settings)).rejects.toBeInstanceOf(EmptyListAlertError);
  });

  it("refuses someone else's private list", async () => {
    findFirstTgUser.mockResolvedValue({ id: 'tg1' });
    findUniqueList.mockResolvedValue({ id: 7, name: 'x', userId: 9, isPublic: false, items: [item('0x1')] });
    await expect(svc.upsert(1, 7, settings)).rejects.toMatchObject({ statusCode: 403 });
  });
});
