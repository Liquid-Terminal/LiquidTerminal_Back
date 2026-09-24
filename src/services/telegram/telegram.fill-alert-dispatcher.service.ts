import { prismaTelegram } from '../../core/prisma.telegram.service';
import { logDeduplicator } from '../../utils/logDeduplicator';
import { HypeDexerLiveDataWSClient } from '../../clients/hypedexer/websocket/live-data.ws.client';
import { HypeDexerSpotFillsWSClient } from '../../clients/hypedexer/websocket/fills-spot.ws.client';
import { TelegramFillSubscriptionService, ActiveFillSubscription } from './telegram.fill-subscription.service';
import { InternalWebSocketServer } from '../../websocket/ws.server';
import { NormalizedFill, AggregatedFill, SpotFill } from '../../types/fill-alerts.types';
import { formatFillAlert } from '../../utils/telegram.formatting';
import { FillAggregator } from './fill-aggregator';
import {
  markAlertSent,
  RecentEventCache,
  SerialQueue,
  startSentAlertPurge,
} from '../../utils/telegram.alert-dedup';

const CONTEXT = 'TelegramFillAlertDispatcherService';

/** A subscription with its coin / wallet filters lower-cased into sets (null = no filter). */
interface CompiledFillSubscription {
  sub: ActiveFillSubscription;
  coins: Set<string> | null;
  wallets: Set<string> | null;
}

/**
 * TelegramFillAlertDispatcherService
 *
 * Bridges HypeDexer fill events (perp `allFills` + spot `fills_spot`) to the
 * Telegram bot via /ws as a single unified "fill_alert".
 *
 * Flow:
 * 1. Subscribes to HypeDexerLiveDataWSClient (allFills) and HypeDexerSpotFillsWSClient (fills_spot)
 * 2. Feeds every fill into the FillAggregator, which groups the fills of one
 *    order (`oid`) and emits a single AggregatedFill after a short debounce
 * 3. On each aggregated order, checks active fill subscriptions (cached 30s)
 * 4. Filters by minUsd, filterCoins, filterWallets
 * 5. Deduplicates via TelegramFillSentAlert unique constraint (subscriptionId, eventId)
 * 6. Pushes matching alerts to InternalWebSocketServer.broadcastFillAlert()
 *    → Bot receives { type: 'fill_alert', data: { telegramId, message } }
 *    → Bot routes by telegramId and calls bot.api.sendMessage()
 *
 * Both streams are network-wide, so fills are dropped as early as possible
 * once the subscriptions are known: all of them when nobody is subscribed,
 * those of unwatched wallets when every subscription is wallet-scoped (before
 * aggregation), and orders matching no subscription (before the DB queue).
 */
export class TelegramFillAlertDispatcherService {
  private static instance: TelegramFillAlertDispatcherService;

  private liveDataClient: HypeDexerLiveDataWSClient | null = null;
  private spotClient: HypeDexerSpotFillsWSClient | null = null;
  private unsubscribePerp: (() => void) | null = null;
  private unsubscribeSpot: (() => void) | null = null;

  private subscriptionCache: CompiledFillSubscription[] = [];
  private cacheLoadedAt: number = 0;
  private static readonly CACHE_TTL_MS = 30_000;
  // Until the first load succeeds nothing is filtered upstream of dispatch().
  private subscriptionsLoaded = false;
  // Union of the watched wallets when every subscription is wallet-scoped, else null.
  private watchedWallets: Set<string> | null = null;
  private cacheRefresh: Promise<void> | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  /** Orders waiting for the DB beyond this are dropped rather than piling up in memory. */
  private static readonly MAX_QUEUED_ORDERS = 10_000;

  // In-memory dedup: absorbs WS re-flushes/reconnects so the DB is hit once per alert
  private readonly recentAlerts = new RecentEventCache();
  // Serializes dispatch batches (perp + spot) so they never overlap and exhaust the DB pool
  private readonly queue = new SerialQueue(CONTEXT, TelegramFillAlertDispatcherService.MAX_QUEUED_ORDERS);
  private purgeTimer: NodeJS.Timeout | null = null;

  // Groups the many fills of one order into a single alert (anti-spam).
  private readonly aggregator = new FillAggregator((agg) => {
    // dispatch() re-checks against a fresh cache; this only spares the queue
    // the orders nobody can be alerted about.
    if (this.subscriptionsLoaded && !this.subscriptionCache.some((c) => this.matchesFilters(agg, c))) {
      return;
    }
    this.queue.enqueue(() => this.dispatch(agg));
  });

  private constructor() {}

  public static getInstance(): TelegramFillAlertDispatcherService {
    if (!TelegramFillAlertDispatcherService.instance) {
      TelegramFillAlertDispatcherService.instance = new TelegramFillAlertDispatcherService();
    }
    return TelegramFillAlertDispatcherService.instance;
  }

  /**
   * Start the dispatcher — connect to both HypeDexer fill streams and begin dispatching.
   */
  public start(): void {
    this.liveDataClient = HypeDexerLiveDataWSClient.getInstance();
    this.spotClient = HypeDexerSpotFillsWSClient.getInstance();

    // Both streams feed the aggregator; it emits one AggregatedFill per order,
    // which is then enqueued onto the serial dispatch queue.
    this.unsubscribePerp = this.liveDataClient.onFill((fills) => {
      if (this.nobodySubscribed()) return;
      for (const fill of fills) {
        if (this.isWatched(fill.wallet)) this.aggregator.add(fill);
      }
    });

    this.unsubscribeSpot = this.spotClient.onSpotFill((fills) => {
      if (this.nobodySubscribed()) return;
      for (const fill of fills) {
        const normalized = this.spotToNormalized(fill);
        if (this.isWatched(normalized.wallet)) this.aggregator.add(normalized);
      }
    });

    // The subscriptions are refreshed on a timer, not only from dispatch():
    // with nobody subscribed, fills never reach dispatch() at all.
    void this.refreshSubscriptions();
    this.refreshTimer = setInterval(() => {
      void this.refreshSubscriptions();
    }, TelegramFillAlertDispatcherService.CACHE_TTL_MS);
    this.refreshTimer.unref();

    this.purgeTimer = startSentAlertPurge(
      (cutoff) =>
        prismaTelegram.telegramFillSentAlert.deleteMany({ where: { sentAt: { lt: cutoff } } }),
      CONTEXT
    );

    // Idempotent — BaseWebSocketService guards against double-connect.
    this.liveDataClient.start();
    this.spotClient.start();

    logDeduplicator.info('TelegramFillAlertDispatcherService: Started');
  }

  /**
   * Stop the dispatcher — remove callbacks and stop the WS clients.
   */
  public stop(): void {
    if (this.unsubscribePerp) {
      this.unsubscribePerp();
      this.unsubscribePerp = null;
    }
    if (this.unsubscribeSpot) {
      this.unsubscribeSpot();
      this.unsubscribeSpot = null;
    }
    if (this.liveDataClient) {
      this.liveDataClient.stop();
      this.liveDataClient = null;
    }
    if (this.spotClient) {
      this.spotClient.stop();
      this.spotClient = null;
    }
    if (this.purgeTimer) {
      clearInterval(this.purgeTimer);
      this.purgeTimer = null;
    }
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.aggregator.clear();
    this.subscriptionCache = [];
    this.cacheLoadedAt = 0;
    this.subscriptionsLoaded = false;
    this.watchedWallets = null;
    this.recentAlerts.clear();

    logDeduplicator.info('TelegramFillAlertDispatcherService: Stopped');
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Map a normalized SpotFill (from the spot WS client) to the unified NormalizedFill.
   */
  private spotToNormalized(fill: SpotFill): NormalizedFill {
    return {
      source: 'spot',
      oid: fill.oid,
      wallet: fill.user.toLowerCase(),
      coin: fill.coin,
      px: fill.px,
      sz: fill.sz,
      notionalUsd: fill.notionalUsd,
      side: fill.side,
      time: fill.time,
      hash: fill.hash,
    };
  }

  /** True once the subscriptions are known and there are none: every fill can be dropped. */
  private nobodySubscribed(): boolean {
    return this.subscriptionsLoaded && this.subscriptionCache.length === 0;
  }

  /**
   * False only when no subscription can match a fill from this wallet. All the
   * fills of an order share its wallet, so dropping them before aggregation
   * cannot change what is dispatched.
   */
  private isWatched(wallet: string): boolean {
    return this.watchedWallets === null || this.watchedWallets.has(wallet);
  }

  /**
   * Reload subscription cache if stale (every 30s).
   */
  private async ensureCacheFresh(): Promise<void> {
    if (Date.now() - this.cacheLoadedAt < TelegramFillAlertDispatcherService.CACHE_TTL_MS) return;
    await this.refreshSubscriptions();
  }

  /** Reload the active subscriptions; concurrent callers share one query. */
  private refreshSubscriptions(): Promise<void> {
    if (!this.cacheRefresh) {
      this.cacheRefresh = this.loadSubscriptions().finally(() => {
        this.cacheRefresh = null;
      });
    }
    return this.cacheRefresh;
  }

  private async loadSubscriptions(): Promise<void> {
    try {
      const subscriptions = await TelegramFillSubscriptionService.getInstance().getActiveSubscriptions();
      this.setSubscriptions(subscriptions);
      this.cacheLoadedAt = Date.now();

      logDeduplicator.debug('TelegramFillAlertDispatcherService: Subscription cache refreshed', {
        count: this.subscriptionCache.length,
      });
    } catch (error) {
      logDeduplicator.error('TelegramFillAlertDispatcherService: Failed to refresh subscription cache', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private setSubscriptions(subscriptions: ActiveFillSubscription[]): void {
    const compiled = subscriptions.map((sub) => ({
      sub,
      coins: sub.filterCoins.length > 0 ? new Set(sub.filterCoins.map((c) => c.toLowerCase())) : null,
      wallets: sub.filterWallets.length > 0 ? new Set(sub.filterWallets.map((w) => w.toLowerCase())) : null,
    }));

    let watched: Set<string> | null = new Set();
    for (const { wallets } of compiled) {
      if (!wallets) {
        watched = null;
        break;
      }
      for (const wallet of wallets) watched.add(wallet);
    }

    this.subscriptionCache = compiled;
    this.watchedWallets = compiled.length > 0 ? watched : null;
    this.subscriptionsLoaded = true;
  }

  /**
   * Dispatch a single aggregated order to all matching subscriptions.
   */
  private async dispatch(fill: AggregatedFill): Promise<void> {
    await this.ensureCacheFresh();

    if (this.subscriptionCache.length === 0) return;

    for (const compiled of this.subscriptionCache) {
      if (!this.matchesFilters(fill, compiled)) continue;
      const { sub } = compiled;

      // Deduplicate — in-memory first (no DB hit), then atomic insert.
      const dedupKey = `${sub.id}|${fill.eventId}`;
      if (this.recentAlerts.has(dedupKey)) continue;

      const sentResult = await markAlertSent(
        () =>
          prismaTelegram.telegramFillSentAlert.create({
            data: { subscriptionId: sub.id, eventId: fill.eventId },
          }),
        CONTEXT
      );
      this.recentAlerts.add(dedupKey);
      // 'duplicate' → already sent, skip. 'new'/'error' → send (fail open on DB error).
      if (sentResult === 'duplicate') continue;

      // Format message and broadcast via /ws.
      try {
        const message = formatFillAlert(fill, sub.name);
        InternalWebSocketServer.getInstance().broadcastFillAlert(sub.telegramId, message);

        logDeduplicator.info('TelegramFillAlertDispatcherService: Alert dispatched', {
          telegramId: sub.telegramId,
          eventId: fill.eventId,
          source: fill.source,
          coin: fill.coin,
          notionalUsd: fill.notionalUsd,
        });
      } catch (error) {
        logDeduplicator.error('TelegramFillAlertDispatcherService: Failed to broadcast alert', {
          error: error instanceof Error ? error.message : String(error),
          subscriptionId: sub.id,
          eventId: fill.eventId,
        });
      }
    }
  }

  /**
   * Check if a fill matches a subscription's filters.
   */
  private matchesFilters(fill: AggregatedFill, { sub, coins, wallets }: CompiledFillSubscription): boolean {
    // Filter by minimum notional USD.
    if (sub.minUsd > 0 && fill.notionalUsd < sub.minUsd) {
      return false;
    }

    // Filter by maximum notional USD (null/0 = no cap).
    if (sub.maxUsd != null && sub.maxUsd > 0 && fill.notionalUsd > sub.maxUsd) {
      return false;
    }

    // Filter by coin (case-insensitive).
    if (coins && !coins.has(fill.coin.toLowerCase())) {
      return false;
    }

    // Filter by wallet (compare lowercase — fill.wallet is already lowercase).
    if (wallets && !wallets.has(fill.wallet)) {
      return false;
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
    }

    return true;
  }
}
