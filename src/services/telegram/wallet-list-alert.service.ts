import { prisma } from '../../core/prisma.service';
import { prismaTelegram } from '../../core/prisma.telegram.service';
import { logDeduplicator } from '../../utils/logDeduplicator';
import { TelegramError } from '../../errors/telegram.errors';
import { WalletListNotFoundError, WalletListPermissionError } from '../../errors/walletlist.errors';

/** Same cap the bot applies to fill subscriptions, so both sides agree. */
const MAX_FILL_SUBSCRIPTIONS_PER_USER = 10;
/** Upper bound on the wallets one list alert matches (dispatch is O(subs x wallets)). */
const MAX_WALLETS_PER_ALERT = 500;
const NAME_MAX = 100;

export type AlertDirection = 'OPEN' | 'CLOSE' | 'FLIP' | null;
export type AlertSource = 'PERP' | 'SPOT' | null;

export interface ListAlertSettings {
  minUsd: number;
  direction: AlertDirection;
  source: AlertSource;
  isActive: boolean;
}

export interface ListAlertView extends ListAlertSettings {
  walletListId: number;
  listName: string;
  isOwner: boolean;
  isPublic: boolean;
  walletCount: number;
  /** false when the subscription was deleted from Telegram; saving recreates it. */
  inTelegram: boolean;
  createdAt: Date;
}

/** Live wallet set and labels of a list-driven fill subscription. */
export interface ResolvedListAlert {
  walletListId: number;
  wallets: string[];
  labels: Record<string, string>;
}

export class TelegramNotLinkedForAlertsError extends TelegramError {
  constructor() {
    super('Link your Telegram account first to receive alerts', 409, 'TELEGRAM_NOT_LINKED');
    this.name = 'TelegramNotLinkedForAlertsError';
  }
}

export class ListAlertLimitError extends TelegramError {
  constructor() {
    super(`You can have at most ${MAX_FILL_SUBSCRIPTIONS_PER_USER} fill alerts in Telegram`, 409, 'ALERT_LIMIT');
    this.name = 'ListAlertLimitError';
  }
}

export class EmptyListAlertError extends TelegramError {
  constructor() {
    super('Add at least one wallet to this list before turning alerts on', 400, 'EMPTY_LIST');
    this.name = 'EmptyListAlertError';
  }
}

const listInclude = {
  items: {
    orderBy: { order: 'asc' as const },
    include: { userWallet: { include: { Wallet: { select: { address: true } } } } },
  },
};

type ListWithItems = {
  id: number;
  name: string;
  userId: number;
  isPublic: boolean;
  items: { userWallet: { name: string | null; Wallet: { address: string } } }[];
};

function walletsOf(list: ListWithItems): { wallets: string[]; labels: Record<string, string> } {
  const labels: Record<string, string> = {};
  const seen = new Set<string>();
  const wallets: string[] = [];
  for (const item of list.items) {
    const addr = item.userWallet.Wallet.address.toLowerCase();
    if (seen.has(addr)) continue;
    seen.add(addr);
    wallets.push(addr);
    if (item.userWallet.name) labels[addr] = item.userWallet.name.slice(0, 40);
    if (wallets.length >= MAX_WALLETS_PER_ALERT) break;
  }
  return { wallets, labels };
}

const subscriptionName = (listName: string) => `List · ${listName}`.slice(0, NAME_MAX);

/**
 * Telegram alerts driven by Liquid Terminal wallet lists.
 *
 * Each alert is a regular fill subscription in the Telegram DB (so the bot
 * lists, pauses and deletes it like any other), plus a WalletListAlert row in
 * the core DB that ties it to a list. The fill dispatcher re-resolves the
 * wallet set from the list on every cache refresh: editing the list on the
 * site changes the alerts within 30 seconds, with nothing to redo in Telegram.
 */
export class WalletListAlertService {
  private static instance: WalletListAlertService;

  public static getInstance(): WalletListAlertService {
    if (!WalletListAlertService.instance) WalletListAlertService.instance = new WalletListAlertService();
    return WalletListAlertService.instance;
  }

  private async telegramUserFor(userId: number) {
    return prismaTelegram.telegramUser.findFirst({
      where: { linkedUserId: userId },
      select: { id: true, username: true, firstName: true },
    });
  }

  private async readableList(userId: number, walletListId: number): Promise<ListWithItems> {
    const list = await prisma.walletList.findUnique({ where: { id: walletListId }, include: listInclude });
    if (!list) throw new WalletListNotFoundError();
    if (list.userId !== userId && !list.isPublic) throw new WalletListPermissionError();
    return list;
  }

  /** All list alerts of a user, with the state of their Telegram subscription. */
  async list(userId: number): Promise<{ telegram: { linked: boolean; username: string | null }; alerts: ListAlertView[] }> {
    const tgUser = await this.telegramUserFor(userId);
    const rows = await prisma.walletListAlert.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: { walletList: { include: listInclude } },
    });
    const subs = rows.length
      ? await prismaTelegram.telegramFillSubscription.findMany({
          where: { id: { in: rows.map((r) => r.fillSubscriptionId) } },
        })
      : [];
    const subById = new Map(subs.map((s) => [s.id, s]));

    const alerts = rows.map((r): ListAlertView => {
      const sub = subById.get(r.fillSubscriptionId);
      return {
        walletListId: r.walletListId,
        listName: r.walletList.name,
        isOwner: r.walletList.userId === userId,
        isPublic: r.walletList.isPublic,
        walletCount: walletsOf(r.walletList).wallets.length,
        inTelegram: Boolean(sub),
        minUsd: sub ? Number(sub.minUsd) : 0,
        direction: (sub?.filterDirection as AlertDirection) ?? null,
        source: (sub?.filterSource as AlertSource) ?? null,
        isActive: sub?.isActive ?? false,
        createdAt: r.createdAt,
      };
    });

    return {
      telegram: { linked: Boolean(tgUser), username: tgUser ? tgUser.username || tgUser.firstName || null : null },
      alerts,
    };
  }

  /** Turn alerts on for a list, or update them. Recreates the subscription if it was deleted in Telegram. */
  async upsert(userId: number, walletListId: number, settings: ListAlertSettings): Promise<ListAlertView> {
    const tgUser = await this.telegramUserFor(userId);
    if (!tgUser) throw new TelegramNotLinkedForAlertsError();

    const list = await this.readableList(userId, walletListId);
    const { wallets } = walletsOf(list);
    if (wallets.length === 0) throw new EmptyListAlertError();

    const data = {
      name: subscriptionName(list.name),
      isActive: settings.isActive,
      filterWallets: wallets,
      filterCoins: [],
      minUsd: settings.minUsd,
      filterDirection: settings.direction,
      filterSource: settings.source,
      filterSide: null,
      maxUsd: null,
    };

    const existing = await prisma.walletListAlert.findUnique({
      where: { userId_walletListId: { userId, walletListId } },
    });
    const liveSub = existing
      ? await prismaTelegram.telegramFillSubscription.findUnique({ where: { id: existing.fillSubscriptionId } })
      : null;

    if (existing && liveSub && liveSub.telegramUserId === tgUser.id) {
      await prismaTelegram.telegramFillSubscription.update({ where: { id: liveSub.id }, data });
    } else {
      const count = await prismaTelegram.telegramFillSubscription.count({ where: { telegramUserId: tgUser.id } });
      if (count >= MAX_FILL_SUBSCRIPTIONS_PER_USER) throw new ListAlertLimitError();

      const sub = await prismaTelegram.telegramFillSubscription.create({
        data: { ...data, telegramUserId: tgUser.id },
      });
      try {
        if (existing) {
          await prisma.walletListAlert.update({ where: { id: existing.id }, data: { fillSubscriptionId: sub.id } });
        } else {
          await prisma.walletListAlert.create({ data: { userId, walletListId, fillSubscriptionId: sub.id } });
        }
      } catch (error) {
        // No cross-DB transaction: undo the subscription so it can't fire unowned.
        await prismaTelegram.telegramFillSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
        throw error;
      }
    }

    logDeduplicator.info('WalletListAlert saved', { userId, walletListId, wallets: wallets.length });
    const view = (await this.list(userId)).alerts.find((a) => a.walletListId === walletListId);
    if (!view) throw new WalletListNotFoundError();
    return view;
  }

  /** Turn alerts off for a list: removes the Telegram subscription and the link row. */
  async remove(userId: number, walletListId: number): Promise<void> {
    const existing = await prisma.walletListAlert.findUnique({
      where: { userId_walletListId: { userId, walletListId } },
    });
    if (!existing) return;
    await prismaTelegram.telegramFillSubscription
      .deleteMany({ where: { id: existing.fillSubscriptionId } })
      .catch((error) =>
        logDeduplicator.warn('WalletListAlert: could not delete Telegram subscription', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    await prisma.walletListAlert.delete({ where: { id: existing.id } });
  }

  /**
   * Remove every alert that follows a list (called before the list is deleted:
   * the core rows cascade, but the Telegram subscriptions live in another DB).
   */
  async removeAllForList(walletListId: number): Promise<void> {
    const rows = await prisma.walletListAlert.findMany({ where: { walletListId }, select: { fillSubscriptionId: true } });
    if (!rows.length) return;
    await prismaTelegram.telegramFillSubscription.deleteMany({
      where: { id: { in: rows.map((r) => r.fillSubscriptionId) } },
    });
  }

  /**
   * For the fill dispatcher: the live wallet set of each list-driven
   * subscription among `subscriptionIds`. A subscription maps to null when it
   * must not fire: Telegram unlinked from the owner, list gone private, or the
   * list is empty (an empty wallet filter would otherwise match every wallet).
   */
  async resolve(
    subscriptions: { id: string; linkedUserId: number | null }[]
  ): Promise<Map<string, ResolvedListAlert | null>> {
    const out = new Map<string, ResolvedListAlert | null>();
    if (!subscriptions.length) return out;
    const rows = await prisma.walletListAlert.findMany({
      where: { fillSubscriptionId: { in: subscriptions.map((s) => s.id) } },
      include: { walletList: { include: listInclude } },
    });
    const ownerOf = new Map(subscriptions.map((s) => [s.id, s.linkedUserId]));
    for (const r of rows) {
      const allowed =
        ownerOf.get(r.fillSubscriptionId) === r.userId &&
        (r.walletList.userId === r.userId || r.walletList.isPublic);
      const { wallets, labels } = walletsOf(r.walletList);
      out.set(r.fillSubscriptionId, allowed && wallets.length ? { walletListId: r.walletListId, wallets, labels } : null);
    }
    return out;
  }
}
