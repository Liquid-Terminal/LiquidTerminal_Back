import { prismaTelegram } from '../../core/prisma.telegram.service';
import { logDeduplicator } from '../../utils/logDeduplicator';
import { HypeDexerCompletedTradesWSClient } from '../../clients/hypedexer/websocket/completed-trades.ws.client';
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
 * Bridges HypeDexer completed_trades events to the Telegram bot via /ws.
 *
 * Flow:
 * 1. Subscribes to HypeDexerCompletedTradesWSClient (1 global sub)
 * 2. Hands each closed trade to the shared AlertEngine: indexed match on the
 *    subscription's wallets (none = no alert), TRADE event type and minimum
 *    position value; Redis dedup per (subscription, tradeId); per-user budget
 * 3. Delivers via InternalWebSocketServer.broadcastWalletEvent()
 *    → Bot receives { type: 'wallet_event', data: { telegramId, trade, subscriptionName } }
 */
export class TelegramWalletDispatcherService {
  private static instance: TelegramWalletDispatcherService;

  private wsClient: HypeDexerCompletedTradesWSClient | null = null;
  private unsubscribeCallback: (() => void) | null = null;

  private readonly engine = new AlertEngine<CompletedTrade, TradeRule>({
    name: 'trade',
    loadRules: async () =>
      ((await TelegramWalletSubscriptionService.getInstance().getActiveSubscriptions()) as ActiveSubscription[])
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
        })),
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
   * Start the dispatcher — connect to HypeDexer and begin dispatching
   */
  public start(): void {
    this.wsClient = HypeDexerCompletedTradesWSClient.getInstance();
    this.wsClient.start();

    // The engine queues batches serially (bounded), so they never overlap.
    this.engine.start();
    this.unsubscribeCallback = this.wsClient.onCompletedTrade((trades) => this.engine.ingest(trades));

    // Legacy dedup rows (dedup now lives in Redis): purge what is left.
    this.purgeTimer = startSentAlertPurge(
      (cutoff) =>
        prismaTelegram.telegramWalletSentAlert.deleteMany({ where: { sentAt: { lt: cutoff } } }),
      CONTEXT
    );

    logDeduplicator.info('TelegramWalletDispatcherService: Started');
  }

  /**
   * Stop the dispatcher — disconnect WS and clear cache
   */
  public stop(): void {
    if (this.unsubscribeCallback) {
      this.unsubscribeCallback();
      this.unsubscribeCallback = null;
    }
    if (this.wsClient) {
      this.wsClient.stop();
      this.wsClient = null;
    }
    if (this.purgeTimer) {
      clearInterval(this.purgeTimer);
      this.purgeTimer = null;
    }
    this.engine.stop();

    logDeduplicator.info('TelegramWalletDispatcherService: Stopped');
  }
}
