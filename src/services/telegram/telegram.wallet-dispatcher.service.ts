import { prismaTelegram } from '../../core/prisma.telegram.service';
import { logDeduplicator } from '../../utils/logDeduplicator';
import { HypeDexerCompletedTradesPoller } from '../../clients/hypedexer/rest/completed-trades/completed-trades-poller.client';
import { TelegramWalletSubscriptionService } from './telegram.wallet-subscription.service';
import { InternalWebSocketServer } from '../../websocket/ws.server';
import { CompletedTrade } from '../../types/wallet-events.types';
import { startSentAlertPurge } from '../../utils/telegram.alert-dedup';
import { formatTradeDigestLine } from '../../utils/telegram.formatting';
import { AlertEngine, AlertRule } from '../alerts/alert-engine';

const CONTEXT = 'TelegramWalletDispatcherService';

interface TradeRule extends AlertRule<CompletedTrade> {
  name: string;
}

/**
 * Shape of an active subscription returned by getActiveSubscriptions()
 */
interface ActiveSubscription {
  id: string;
  telegramId: string;
  name: string;
  walletAddresses: string[];
  eventTypes: string[];
  minAmountUsd: number;
}

/**
 * TelegramWalletDispatcherService
 *
 * Bridges HypeDexer completed trades to the Telegram bot via /ws.
 *
 * Flow:
 * 1. Subscribes to HypeDexerCompletedTradesPoller (network-wide, polled every 5s)
 * 2. Hands each closed trade to the shared AlertEngine: indexed match on the
 *    subscription's wallets (none = no alert), TRADE event type and minimum
 *    position value; Redis dedup per (subscription, tradeId); per-user budget
 * 3. Delivers via InternalWebSocketServer.broadcastWalletEvent()
 *    → Bot receives { type: 'wallet_event', data: { telegramId, trade, subscriptionName } }
 *
 * The feed is network-wide while every subscription is wallet-scoped: once
 * the rules are known, only trades of a watched wallet are queued, and the
 * feed is paused while no wallet is watched at all.
 */
export class TelegramWalletDispatcherService {
  private static instance: TelegramWalletDispatcherService;

  private feed: HypeDexerCompletedTradesPoller | null = null;
  private unsubscribeCallback: (() => void) | null = null;

  // Until the engine's first rule load every batch is queued.
  private rulesLoaded = false;
  // Union of every rule's wallets.
  private watchedWallets = new Set<string>();

  private readonly engine = new AlertEngine<CompletedTrade, TradeRule>({
    name: 'trade',
    loadRules: async () => {
      const rules = ((await TelegramWalletSubscriptionService.getInstance().getActiveSubscriptions()) as ActiveSubscription[])
        // A wallet subscription without wallets never matched: keep it that way
        // (an empty wallet list would mean "every wallet" to the index).
        .filter((sub) => sub.walletAddresses.length > 0)
        .map((sub) => ({
          id: sub.id,
          telegramId: sub.telegramId,
          wallets: sub.walletAddresses.map((a) => a.toLowerCase()),
          coins: [],
          matches: (trade: CompletedTrade) =>
            (sub.eventTypes.length === 0 || sub.eventTypes.includes('TRADE')) &&
            trade.positionValue >= sub.minAmountUsd,
          dedupScope: sub.id,
          name: sub.name,
        }));
      this.setPrefilter(rules);
      return rules;
    },
    keys: (trade) => ({ id: trade.tradeId, wallets: [trade.user], coin: trade.coin }),
    deliver: (rule, trade) => {
      InternalWebSocketServer.getInstance().broadcastWalletEvent(rule.telegramId, trade, rule.name);
    },
    summarize: (rule, trade) => formatTradeDigestLine(trade, rule.name),
    // wallet_event carries a trade, not text: digests go through the plain-text channel.
    notify: (telegramId, message) => {
      InternalWebSocketServer.getInstance().broadcastFillAlert(telegramId, message);
    },
  });

  private purgeTimer: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): TelegramWalletDispatcherService {
    if (!TelegramWalletDispatcherService.instance) {
      TelegramWalletDispatcherService.instance = new TelegramWalletDispatcherService();
    }
    return TelegramWalletDispatcherService.instance;
  }

  /**
   * Start the dispatcher — start the HypeDexer feed and begin dispatching
   */
  public start(): void {
    this.feed = HypeDexerCompletedTradesPoller.getInstance();

    this.unsubscribeCallback = this.feed.onCompletedTrade((trades) => {
      const relevant = this.rulesLoaded
        ? trades.filter((trade) => this.watchedWallets.has(trade.user))
        : trades;
      this.engine.ingest(relevant);
    });
    this.feed.start();

    // The engine queues batches serially (bounded), so they never overlap. Its
    // rule loads pause the feed while no wallet is watched — after start(),
    // which unpauses it.
    this.engine.start();

    // Legacy dedup rows (dedup now lives in Redis): purge what is left.
    this.purgeTimer = startSentAlertPurge(
      (cutoff) =>
        prismaTelegram.telegramWalletSentAlert.deleteMany({ where: { sentAt: { lt: cutoff } } }),
      CONTEXT
    );

    logDeduplicator.info('TelegramWalletDispatcherService: Started');
  }

  /**
   * Stop the dispatcher — stop the feed and clear the rules
   */
  public stop(): void {
    if (this.unsubscribeCallback) {
      this.unsubscribeCallback();
      this.unsubscribeCallback = null;
    }
    if (this.feed) {
      this.feed.stop();
      this.feed = null;
    }
    if (this.purgeTimer) {
      clearInterval(this.purgeTimer);
      this.purgeTimer = null;
    }
    this.engine.stop();
    this.rulesLoaded = false;
    this.watchedWallets = new Set();

    logDeduplicator.info('TelegramWalletDispatcherService: Stopped');
  }

  /** Called with every rule set the engine loads (a failed load keeps the previous one). */
  private setPrefilter(rules: TradeRule[]): void {
    const watched = new Set<string>();
    for (const rule of rules) {
      for (const wallet of rule.wallets) watched.add(wallet);
    }
    this.watchedWallets = watched;
    this.rulesLoaded = true;
    // No watched wallet, no possible alert: skip the network-wide requests.
    this.feed?.setPaused(watched.size === 0);
  }
}
