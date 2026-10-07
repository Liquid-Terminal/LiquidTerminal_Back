import { prismaTelegram } from '../../core/prisma.telegram.service';
import { logDeduplicator } from '../../utils/logDeduplicator';
import { HypeDexerLiveDataWSClient } from '../../clients/hypedexer/websocket/live-data.ws.client';
import { TelegramFillSubscriptionService, ActiveFillSubscription } from './telegram.fill-subscription.service';
import { InternalWebSocketServer } from '../../websocket/ws.server';
import { SpotCoinNameService } from '../spot/spotCoinNames.service';
import { AggregatedFill } from '../../types/fill-alerts.types';
import { formatFillAlert, formatFillDigestLine } from '../../utils/telegram.formatting';
import { prefetchWalletNames } from '../names/alert-wallet-names';
import { FillAggregator } from './fill-aggregator';
import { startSentAlertPurge } from '../../utils/telegram.alert-dedup';
import { AlertEngine, AlertRule } from '../alerts/alert-engine';

interface FillRule extends AlertRule<AggregatedFill> {
  sub: ActiveFillSubscription;
}

const CONTEXT = 'TelegramFillAlertDispatcherService';

/**
 * TelegramFillAlertDispatcherService
 *
 * Bridges HypeDexer fill events (`allFills`, perp and spot) to the Telegram
 * bot via /ws as a single unified "fill_alert".
 *
 * Flow:
 * 1. Subscribes to HypeDexerLiveDataWSClient (allFills)
 * 2. Feeds every fill into the FillAggregator (spot pair ids resolved to token
 *    names first), which groups the fills of one order (`oid`) and emits a
 *    single AggregatedFill after a short debounce
 * 3. Hands each aggregated order to the shared AlertEngine: indexed match
 *    on wallet/coin, then size/side/source/direction filters, Redis dedup
 *    per (subscription, eventId), per-user budget
 * 4. Delivers via InternalWebSocketServer.broadcastFillAlert()
 *    → Bot receives { type: 'fill_alert', data: { telegramId, message } }
 *    → Bot routes by telegramId and calls bot.api.sendMessage()
 *
 * The stream is network-wide, so once the rules are known fills are dropped
 * before aggregation: all of them when nobody is subscribed, those of
 * unwatched wallets when every subscription is wallet-scoped.
 */
export class TelegramFillAlertDispatcherService {
  private static instance: TelegramFillAlertDispatcherService;

  private liveDataClient: HypeDexerLiveDataWSClient | null = null;
  private unsubscribeFills: (() => void) | null = null;
  private readonly spotNames = SpotCoinNameService.getInstance();

  // Until the engine's first rule load nothing is dropped upstream of it.
  private rulesLoaded = false;
  private ruleCount = 0;
  // Union of the watched wallets when every rule is wallet-scoped, else null.
  private watchedWallets: Set<string> | null = null;

  // Matching, dedup, per-user budget and back-pressure (shared alert engine).
  private readonly engine = new AlertEngine<AggregatedFill, FillRule>({
    name: 'fill',
    loadRules: async () => {
      const rules = (await TelegramFillSubscriptionService.getInstance().getActiveSubscriptions()).map((sub) => ({
        id: sub.id,
        telegramId: sub.telegramId,
        wallets: sub.filterWallets.map((w) => w.toLowerCase()),
        coins: sub.filterCoins.map((c) => c.toUpperCase()),
        matches: (fill: AggregatedFill) => TelegramFillAlertDispatcherService.matchesFilters(fill, sub),
        dedupScope: sub.id,
        sub,
      }));
      this.setPrefilter(rules);
      return rules;
    },
    keys: (fill) => ({ id: fill.eventId, wallets: [fill.wallet], coin: fill.coin }),
    deliver: (rule, fill) => {
      const message = formatFillAlert(fill, rule.sub.name, {
        walletLabel: rule.sub.walletLabels?.[fill.wallet],
        fromList: rule.sub.walletListId !== undefined,
      });
      InternalWebSocketServer.getInstance().broadcastFillAlert(rule.telegramId, message);
    },
    prepare: (fills) => prefetchWalletNames(fills.map((f) => f.wallet)),
    summarize: (rule, fill) => formatFillDigestLine(fill, rule.sub.name, rule.sub.walletLabels?.[fill.wallet]),
    notify: (telegramId, message) => {
      InternalWebSocketServer.getInstance().broadcastFillAlert(telegramId, message);
    },
  });

  private purgeTimer: NodeJS.Timeout | null = null;

  // Groups the many fills of one order into a single alert (anti-spam).
  private readonly aggregator = new FillAggregator((agg) => this.engine.ingest([agg]));

  private constructor() {}

  public static getInstance(): TelegramFillAlertDispatcherService {
    if (!TelegramFillAlertDispatcherService.instance) {
      TelegramFillAlertDispatcherService.instance = new TelegramFillAlertDispatcherService();
    }
    return TelegramFillAlertDispatcherService.instance;
  }

  /**
   * Start the dispatcher — connect to the HypeDexer fill stream and begin dispatching.
   */
  public start(): void {
    this.liveDataClient = HypeDexerLiveDataWSClient.getInstance();
    // Loaded ahead of the first spot fill so its alert already shows the token name.
    void this.spotNames.reload();

    // The stream feeds the aggregator; it emits one AggregatedFill per order,
    // which the alert engine queues, matches and delivers.
    this.unsubscribeFills = this.liveDataClient.onFill((fills) => {
      if (this.nobodySubscribed()) return;
      for (const fill of fills) {
        if (!this.isWatched(fill.wallet)) continue;
        // Coin filters and alerts name the token ("HYPE"), not the pair id ("@107").
        this.aggregator.add(
          fill.source === 'spot' ? { ...fill, coin: this.spotNames.resolve(fill.coin) } : fill
        );
      }
    });

    this.engine.start();

    // Legacy dedup rows (dedup now lives in Redis): purge what is left.
    this.purgeTimer = startSentAlertPurge(
      (cutoff) =>
        prismaTelegram.telegramFillSentAlert.deleteMany({ where: { sentAt: { lt: cutoff } } }),
      CONTEXT
    );

    // Idempotent — BaseWebSocketService guards against double-connect.
    this.liveDataClient.start();

    logDeduplicator.info('TelegramFillAlertDispatcherService: Started');
  }

  /**
   * Stop the dispatcher — remove the callback and stop the WS client.
   */
  public stop(): void {
    if (this.unsubscribeFills) {
      this.unsubscribeFills();
      this.unsubscribeFills = null;
    }
    if (this.liveDataClient) {
      this.liveDataClient.stop();
      this.liveDataClient = null;
    }
    if (this.purgeTimer) {
      clearInterval(this.purgeTimer);
      this.purgeTimer = null;
    }
    this.aggregator.clear();
    this.engine.stop();
    this.rulesLoaded = false;
    this.ruleCount = 0;
    this.watchedWallets = null;

    logDeduplicator.info('TelegramFillAlertDispatcherService: Stopped');
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /** Called with every rule set the engine loads (a failed load keeps the previous one). */
  private setPrefilter(rules: FillRule[]): void {
    let watched: Set<string> | null = new Set();
    for (const rule of rules) {
      if (rule.wallets.length === 0) {
        watched = null;
        break;
      }
      for (const wallet of rule.wallets) watched.add(wallet);
    }
    this.watchedWallets = rules.length > 0 ? watched : null;
    this.ruleCount = rules.length;
    this.rulesLoaded = true;
  }

  /** True once the rules are known and there are none: every fill can be dropped. */
  private nobodySubscribed(): boolean {
    return this.rulesLoaded && this.ruleCount === 0;
  }

  /**
   * False only when no rule can match a fill from this wallet. All the fills
   * of an order share its wallet, so dropping them before aggregation cannot
   * change what is dispatched.
   */
  private isWatched(wallet: string): boolean {
    return this.watchedWallets === null || this.watchedWallets.has(wallet);
  }

  /**
   * Check if a fill matches a subscription's filters.
   */
  static matchesFilters(fill: AggregatedFill, sub: ActiveFillSubscription): boolean {
    // Filter by minimum notional USD.
    if (sub.minUsd > 0 && fill.notionalUsd < sub.minUsd) {
      return false;
    }

    // Filter by maximum notional USD (null/0 = no cap).
    if (sub.maxUsd != null && sub.maxUsd > 0 && fill.notionalUsd > sub.maxUsd) {
      return false;
    }

    // Coin and wallet are pre-filtered by the engine's index; kept here so
    // this function stays the single, complete definition of a match.
    // Filter by coin (case-insensitive).
    if (sub.filterCoins.length > 0) {
      const coinLower = fill.coin.toLowerCase();
      if (!sub.filterCoins.some((c) => c.toLowerCase() === coinLower)) {
        return false;
      }
    }

    // Filter by wallet (compare lowercase — fill.wallet is already lowercase).
    if (sub.filterWallets.length > 0) {
      if (!sub.filterWallets.some((w) => w.toLowerCase() === fill.wallet)) {
        return false;
      }
    }

    // Filter by side: 'BUY' → 'B', 'SELL' → 'A'.
    if (sub.filterSide === 'BUY' && fill.side !== 'B') return false;
    if (sub.filterSide === 'SELL' && fill.side !== 'A') return false;

    // Filter by source: PERP | SPOT.
    if (sub.filterSource === 'PERP' && fill.source !== 'perp') return false;
    if (sub.filterSource === 'SPOT' && fill.source !== 'spot') return false;

    // Filter by direction (perp only). If the sub explicitly demands a direction
    // and the fill is spot or has no `dir`, exclude it.
    if (sub.filterDirection != null) {
      if (fill.source !== 'perp' || !fill.dir) return false;
      const isOpen = fill.dir.includes('Open');
      const isClose = fill.dir.includes('Close');
      if (sub.filterDirection === 'OPEN' && !isOpen) return false;
      if (sub.filterDirection === 'CLOSE' && !isClose) return false;
      // Hyperliquid names a flip "Long > Short" / "Short > Long".
      if (sub.filterDirection === 'FLIP' && !fill.dir.includes('>')) return false;
    }

    return true;
  }
}
