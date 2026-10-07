import { prismaTelegram } from '../../core/prisma.telegram.service';
import { logDeduplicator } from '../../utils/logDeduplicator';
import { WalletListAlertService, ResolvedListAlert } from './wallet-list-alert.service';

/**
 * Shape of an active fill subscription returned by getActiveSubscriptions().
 */
export interface ActiveFillSubscription {
  id: string;
  telegramUserId: string;
  telegramId: string; // BigInt as string for WS routing
  name: string;
  filterCoins: string[];
  filterWallets: string[];
  minUsd: number;
  /// 'BUY' | 'SELL' | null (both)
  filterSide: 'BUY' | 'SELL' | null;
  /// 'PERP' | 'SPOT' | null (both)
  filterSource: 'PERP' | 'SPOT' | null;
  /// 'OPEN' | 'CLOSE' | 'FLIP' | null (any) — perp only
  filterDirection: 'OPEN' | 'CLOSE' | 'FLIP' | null;
  /// null = no upper bound
  maxUsd: number | null;
  /// Set when the subscription follows a Liquid Terminal wallet list.
  walletListId?: number;
  /// Wallet names from that list, keyed by lowercase address.
  walletLabels?: Record<string, string>;
}

/**
 * Service for reading Telegram fill tracking subscriptions.
 * The fill dispatcher consumes these subscriptions to route executed-order alerts.
 */
export class TelegramFillSubscriptionService {
  private static instance: TelegramFillSubscriptionService;

  private constructor() {}

  public static getInstance(): TelegramFillSubscriptionService {
    if (!TelegramFillSubscriptionService.instance) {
      TelegramFillSubscriptionService.instance = new TelegramFillSubscriptionService();
    }
    return TelegramFillSubscriptionService.instance;
  }

  /**
   * Get all active fill subscriptions (used by the fill dispatcher).
   */
  public async getActiveSubscriptions(): Promise<ActiveFillSubscription[]> {
    const subscriptions = await prismaTelegram.telegramFillSubscription.findMany({
      where: { isActive: true },
      include: {
        telegramUser: {
          select: { telegramId: true, linkedUserId: true },
        },
      },
    });

    // List-driven subscriptions take their wallets from the list, live.
    // Fail-soft: if the core DB is unreachable they keep their last synced
    // snapshot (never empty, see WalletListAlertService.upsert).
    let resolved = new Map<string, ResolvedListAlert | null>();
    try {
      resolved = await WalletListAlertService.getInstance().resolve(
        subscriptions.map((s) => ({ id: s.id, linkedUserId: s.telegramUser.linkedUserId }))
      );
    } catch (error) {
      logDeduplicator.warn('Fill subscriptions: list resolution failed, using snapshots', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const active = subscriptions.filter((sub) => resolved.get(sub.id) !== null);
    this.syncSnapshots(active, resolved);

    return active.map((sub) => ({
      id: sub.id,
      telegramUserId: sub.telegramUserId,
      telegramId: sub.telegramUser.telegramId.toString(),
      name: sub.name,
      filterCoins: sub.filterCoins,
      filterWallets: resolved.get(sub.id)?.wallets ?? sub.filterWallets,
      minUsd: Number(sub.minUsd),
      filterSide: normalizeSide(sub.filterSide),
      filterSource: normalizeSource(sub.filterSource),
      filterDirection: normalizeDirection(sub.filterDirection),
      maxUsd: sub.maxUsd != null ? Number(sub.maxUsd) : null,
      walletListId: resolved.get(sub.id)?.walletListId,
      walletLabels: resolved.get(sub.id)?.labels,
    }));
  }

  /**
   * Write the resolved wallet set back to the Telegram DB when it changed, so
   * the bot's /status shows the right wallets and the snapshot stays a sane
   * fallback. Best effort, off the dispatch path.
   */
  private syncSnapshots(
    subs: { id: string; filterWallets: string[] }[],
    resolved: Map<string, ResolvedListAlert | null>
  ): void {
    for (const sub of subs) {
      const live = resolved.get(sub.id);
      if (!live) continue;
      const same =
        live.wallets.length === sub.filterWallets.length &&
        live.wallets.every((w, i) => w === sub.filterWallets[i]);
      if (same) continue;
      void prismaTelegram.telegramFillSubscription
        .update({ where: { id: sub.id }, data: { filterWallets: live.wallets } })
        .catch(() => undefined);
    }
  }
}

function normalizeSide(value: string | null): 'BUY' | 'SELL' | null {
  if (value === 'BUY' || value === 'SELL') return value;
  return null;
}

function normalizeSource(value: string | null): 'PERP' | 'SPOT' | null {
  if (value === 'PERP' || value === 'SPOT') return value;
  return null;
}

function normalizeDirection(value: string | null): 'OPEN' | 'CLOSE' | 'FLIP' | null {
  if (value === 'OPEN' || value === 'CLOSE' || value === 'FLIP') return value;
  return null;
}
