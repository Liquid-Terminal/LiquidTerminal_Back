import { HypeDexerHip4Client } from '../../clients/hypedexer/rest/hip4/hip4.client';
import { buildHypedexerCacheKey } from '../../clients/hypedexer/rest/shared/hypedexer-cache.helper';
import { cacheService } from '../../core/cache.service';
import {
  HYPEDEXER_HIP4_CACHE_KEY,
  HYPEDEXER_TTL,
  HYPEDEXER_USER_CACHE_KEY,
} from '../../constants/hypedexer.cache';
import {
  enrichMarkets,
  enrichSettlements,
  buildQuestionsWithOutcomes,
  isBareMarketRow,
  toSideCoinMarket,
  type Hip4MarketEnriched,
  type Hip4QuestionWithOutcomes,
  type Hip4SettlementEnriched,
  type RawHip4Market,
  type RawHip4OutcomeToken,
  type RawHip4Question,
  type RawHip4Settlement,
} from '../../utils/hip4-enrichment.util';
import { indexOutcomeTemplates, type Hip4TemplateIndex } from '../../utils/hip4-market-names.util';

type Hip4FillsQuery = NonNullable<Parameters<HypeDexerHip4Client['getFills']>[0]>;

const HOUR_MS = 60 * 60 * 1000;
const HL_INFO_URL = 'https://api.hyperliquid.xyz/info';
/** Markets read one by one to name a settlements page (the list page asks 50 rows, ~17 markets). */
const SETTLEMENT_LOOKUP_CAP = 50;
const SETTLEMENT_LOOKUP_CONCURRENCY = 4;

/** Run `fn` over `items`, at most `limit` in flight, preserving order. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * How long a market's fills stay cached, from the age of its newest fill. An
 * empty answer may be a market about to open, so it is only kept a minute.
 */
function marketFillsTtl(rows: unknown): number {
  if (!Array.isArray(rows) || rows.length === 0) return HYPEDEXER_TTL.hip4QuietFills;
  let newest = 0;
  for (const row of rows) {
    const t = Number((row as { time_ms?: unknown } | null)?.time_ms);
    if (Number.isFinite(t) && t > newest) newest = t;
  }
  // No readable time (field renamed upstream?): don't mistake it for dormant.
  if (newest === 0) return HYPEDEXER_TTL.hip4QuietFills;
  const age = Date.now() - newest;
  if (age >= 24 * HOUR_MS) return HYPEDEXER_TTL.hip4DormantFills;
  if (age >= HOUR_MS) return HYPEDEXER_TTL.hip4QuietFills;
  return HYPEDEXER_TTL.hip4ActiveFills;
}

/**
 * HIP-4 exposed endpoints — assembles raw HypeDexer responses into frontend-ready
 * shapes. The service is NOT a thin pass-through: it joins markets × outcome-tokens ×
 * questions server-side so the frontend never has to cross-reference them.
 *
 * Exposed surface:
 *   - getMarketsEnriched       → flat, used by charts and fills name resolution
 *   - getQuestionsWithOutcomes → hierarchical, used by the question-grid
 *   - getSettlements           → enriched with winner_name + question_name
 *   - getFills                 → pass-through (raw feed is fine)
 */
export class IndexerHip4Service {
  private static instance: IndexerHip4Service;
  private readonly client = HypeDexerHip4Client.getInstance();

  public static getInstance(): IndexerHip4Service {
    if (!IndexerHip4Service.instance) {
      IndexerHip4Service.instance = new IndexerHip4Service();
    }
    return IndexerHip4Service.instance;
  }

  /** Fills — transform raw API shape to frontend-ready shape. */
  public async getFills(p: Hip4FillsQuery = {}): Promise<unknown> {
    const raw = await this.fetchRawFills(p);
    if (!Array.isArray(raw)) return raw;
    return raw.map((fill) => this.transformFill(fill as Record<string, unknown>));
  }

  private fetchRawFills(p: Hip4FillsQuery): Promise<unknown> {
    if (p.user) {
      if (p.start || p.end) return this.client.getFills(p);
      return cacheService.getOrSet(
        HYPEDEXER_USER_CACHE_KEY.hip4Fills(p.user, {
          coin: p.coin,
          outcome_id: p.outcome_id,
          limit: p.limit,
          offset: p.offset,
        }),
        () => this.client.getFills(p),
        HYPEDEXER_TTL.userAddress
      );
    }
    // A market's tape is the same for every visitor: the coin page polls
    // `limit=400` every 15 s and a settled question's chart reads N coins ×
    // 1 000 fills, which used to go upstream once per visitor and per poll.
    return cacheService.getOrSet(
      buildHypedexerCacheKey('hip4', 'fills', { ...p }),
      () => this.client.getFills(p),
      marketFillsTtl
    );
  }

  private transformFill(f: Record<string, unknown>): Record<string, unknown> {
    const timeMs = typeof f.time_ms === 'number' ? f.time_ms : Number(f.time_ms ?? 0);
    const px = Number(f.px ?? 0);
    const sz = Number(f.sz ?? 0);
    const feeUsdc = typeof f.fee_usdc === 'number' ? f.fee_usdc : Number(f.fee_usdc ?? 0);
    return {
      ...f,
      time: new Date(timeMs).toISOString(),
      notional: Number.isFinite(px * sz) ? px * sz : 0,
      fee: feeUsdc,
    };
  }

  /**
   * Flat enriched markets, one Redis entry per param set. The key used to
   * ignore limit/offset, so whichever of `limit=500` (list page) or the default
   * 100 (detail page) filled it first answered both.
   *
   * `outcome_id` looks up that one market instead (other params ignored): the
   * lists hold the oldest markets only (upstream order, no sort), so a deep
   * link to any recent market needs it.
   */
  public async getMarketsEnriched(p: {
    class?: string;
    underlying?: string;
    question_id?: number;
    outcome_id?: number;
    limit?: number;
    offset?: number;
  } = {}): Promise<Hip4MarketEnriched[]> {
    if (p.outcome_id != null) {
      const outcomeId = p.outcome_id;
      return cacheService.getOrSet(
        buildHypedexerCacheKey('hip4', 'markets-enriched', { outcome_id: outcomeId }),
        () => this.assembleMarketByOutcomeId(outcomeId),
        HYPEDEXER_TTL.staticList
      );
    }
    return cacheService.getOrSet(
      buildHypedexerCacheKey('hip4', 'markets-enriched', { ...p }),
      () => this.assembleEnrichedMarkets(p),
      HYPEDEXER_TTL.staticList
    );
  }

  /**
   * Questions with nested outcomes. Singleton markets (no question_id) are
   * surfaced as synthetic 1-outcome questions so the grid handles everything
   * uniformly.
   */
  public async getQuestionsWithOutcomes(p: {
    question_id?: number;
    limit?: number;
    offset?: number;
  } = {}): Promise<Hip4QuestionWithOutcomes[]> {
    const compute = async (): Promise<Hip4QuestionWithOutcomes[]> => {
      const [markets, outcomeTokens, questions, midPrices, templates] = await Promise.all([
        this.fetchRawMarkets(p.question_id != null ? { question_id: p.question_id, limit: p.limit, offset: p.offset } : { limit: p.limit, offset: p.offset }),
        this.fetchRawOutcomeTokens(),
        this.fetchRawQuestions(p.question_id != null ? { question_id: p.question_id } : {}),
        this.fetchHlMidPrices(),
        this.fetchOutcomeTemplates(),
      ]);
      const enriched = enrichMarkets(markets, outcomeTokens, questions, midPrices, templates);
      return buildQuestionsWithOutcomes(enriched, questions);
    };

    // Keyed on every param, like markets-enriched (limit 200 vs default 100).
    return cacheService.getOrSet(
      buildHypedexerCacheKey('hip4', 'questions-with-outcomes', { ...p }),
      compute,
      HYPEDEXER_TTL.staticList
    );
  }

  /**
   * Settlements enriched with winner_name + question_name. Shared for a minute:
   * the list page polls it every 30 s per visitor, and each read joined three
   * upstream metadata lists fetched again every time.
   */
  public async getSettlements(p: {
    outcome_id?: number;
    start?: string;
    end?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<Hip4SettlementEnriched[]> {
    return cacheService.getOrSet(
      buildHypedexerCacheKey('hip4', 'settlements', { ...p }),
      () => this.assembleSettlements(p),
      HYPEDEXER_TTL.hip4Settlements
    );
  }

  private async assembleSettlements(p: {
    outcome_id?: number;
    start?: string;
    end?: string;
    limit?: number;
    offset?: number;
  }): Promise<Hip4SettlementEnriched[]> {
    const [raw, markets, outcomeTokens, questions, midPrices, templates] = await Promise.all([
      this.client.getSettlements<RawHip4Settlement[]>(p),
      this.fetchRawMarkets(),
      this.fetchRawOutcomeTokens(),
      this.fetchRawQuestions(),
      this.fetchHlMidPrices(),
      this.fetchOutcomeTemplates(),
    ]);
    const settlements = asArray<RawHip4Settlement>(raw);
    // The metadata list holds the oldest markets, the settlements are the
    // newest: read each missing market's row (3 credits, kept a day once settled).
    const listed = new Set(markets.map((m) => m.outcome_id));
    const missing = [...new Set(settlements.map((s) => s.outcome_id))]
      .filter((id) => !listed.has(id))
      .slice(0, SETTLEMENT_LOOKUP_CAP);
    const lookedUp = await mapWithConcurrency(missing, SETTLEMENT_LOOKUP_CONCURRENCY, (id) =>
      this.fetchMarketRow(id).catch((): RawHip4Market[] => [])
    );
    const enrichedMarkets = enrichMarkets([...markets, ...lookedUp.flat()], outcomeTokens, questions, midPrices, templates);
    const all = enrichSettlements(settlements, enrichedMarkets, questions);
    // Deduplicate: multiple broadcaster records per outcome → keep latest (highest block_time).
    const seen = new Map<number, Hip4SettlementEnriched>();
    for (const s of all) {
      const existing = seen.get(s.outcome_id);
      if (!existing || s.settled_at > existing.settled_at) seen.set(s.outcome_id, s);
    }
    return Array.from(seen.values());
  }

  /**
   * Time-bucketed analytics — volume, fills, fees and unique traders.
   *
   * Caching strategy, one Redis entry per param set:
   *   - Unfiltered calls (no coin, no outcome_id, no date range): the charts'
   *     buckets, kept a minute.
   *   - Filtered calls (coin lists, outcome splits, date ranges): kept 5 min.
   *     The upstream view is constant-time, but each call is billed per row,
   *     and the live-market volume fan-out sends the same coin chunks for
   *     every visitor.
   */
  public async getAnalytics(p: {
    interval?: string;
    coin?: string;
    outcome_id?: number;
    start?: string;
    end?: string;
    limit?: number;
  } = {}): Promise<unknown> {
    const q = { ...p, interval: p.interval ?? '1h' };
    const hasFilter = p.coin != null || p.outcome_id != null || p.start != null || p.end != null;

    return cacheService.getOrSet(
      hasFilter
        ? buildHypedexerCacheKey('hip4', 'analytics', { ...q })
        : HYPEDEXER_HIP4_CACHE_KEY.analytics(q.interval, q.limit),
      () => this.client.getAnalytics(q),
      hasFilter ? HYPEDEXER_TTL.hip4AnalyticsFiltered : HYPEDEXER_TTL.hip4Analytics,
    );
  }

  /**
   * One market by id. `#X` is what Hyperliquid trades: side X % 10 of outcome
   * floor(X / 10), whose row holds the market (X's own row is a bare
   * placeholder). So a side-coin id reads its outcome's row (3 credits) and
   * answers from side X. Any other id, or one without such an outcome, is
   * read as an outcome itself.
   */
  private async assembleMarketByOutcomeId(outcomeId: number): Promise<Hip4MarketEnriched[]> {
    const isSideCoin = outcomeId >= 10 && outcomeId % 10 <= 1;
    const [parentRows, templates, midPrices] = await Promise.all([
      isSideCoin ? this.fetchMarketRow(Math.floor(outcomeId / 10)) : Promise.resolve([]),
      this.fetchOutcomeTemplates(),
      this.fetchHlMidPrices(),
    ]);
    const parent = parentRows.find((m) => !isBareMarketRow(m));
    if (parent) {
      const [market] = enrichMarkets([parent], [], [], undefined, templates);
      return [toSideCoinMarket(market, outcomeId % 10, midPrices)];
    }
    const own = (await this.fetchMarketRow(outcomeId)).filter((m) => !isBareMarketRow(m));
    return enrichMarkets(own, [], [], midPrices, templates);
  }

  /**
   * One outcome's raw row (repeats dropped), shared by deep links and
   * settlements. Rows for other ids are dropped too, in case the filter is
   * ever ignored upstream.
   */
  private async fetchMarketRow(outcomeId: number): Promise<RawHip4Market[]> {
    const rows = await cacheService.getOrSet(
      buildHypedexerCacheKey('hip4', 'market', { outcome_id: outcomeId }),
      async () => {
        const raw = await this.client.getMarkets<RawHip4Market[]>({ outcome_id: outcomeId });
        return asArray<RawHip4Market>(raw).filter((m) => m.outcome_id === outcomeId).slice(0, 1);
      },
      marketRowTtl
    );
    return asArray<RawHip4Market>(rows);
  }

  /** Shared assembly pipeline used by both enriched endpoints. */
  private async assembleEnrichedMarkets(p: {
    class?: string;
    underlying?: string;
    question_id?: number;
    limit?: number;
    offset?: number;
  }): Promise<Hip4MarketEnriched[]> {
    const [markets, outcomeTokens, questions, midPrices, templates] = await Promise.all([
      this.fetchRawMarkets(p),
      this.fetchRawOutcomeTokens(),
      this.fetchRawQuestions(),
      this.fetchHlMidPrices(),
      this.fetchOutcomeTemplates(),
    ]);
    return enrichMarkets(markets, outcomeTokens, questions, midPrices, templates);
  }

  /**
   * Hyperliquid's template registry, shared for an hour. Markets deployed
   * from a template are named `template:binaryPrice` & co.: the registry holds
   * their title and rules formats. A failed read titles them from their
   * structured fields (or coin) and is retried after a minute.
   */
  private async fetchOutcomeTemplates(): Promise<Hip4TemplateIndex> {
    const raw = await cacheService.getOrSet(
      HYPEDEXER_HIP4_CACHE_KEY.outcomeTemplates,
      () => this.fetchHlOutcomeTemplates(),
      (rows) => (rows.length > 0 ? HYPEDEXER_TTL.hip4OutcomeTemplates : HYPEDEXER_TTL.hip4BaseListRetry)
    );
    return indexOutcomeTemplates(raw);
  }

  private async fetchHlOutcomeTemplates(): Promise<unknown[]> {
    try {
      const resp = await fetch(HL_INFO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'outcomeTemplates' }),
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) return [];
      const data: unknown = await resp.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  /** Fetch live mid prices for all HIP-4 coins (#N) from HL allMids. */
  private async fetchHlMidPrices(): Promise<Map<string, number>> {
    try {
      const resp = await fetch(HL_INFO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'allMids' }),
      });
      const data = await resp.json() as Record<string, string>;
      const map = new Map<string, number>();
      for (const [coin, price] of Object.entries(data)) {
        if (coin.startsWith('#')) {
          const px = parseFloat(price);
          if (Number.isFinite(px)) map.set(coin, px);
        }
      }
      return map;
    } catch {
      return new Map();
    }
  }

  /*
   * Upstream metadata lists, one shared Redis entry per param set: every
   * enriched endpoint and settlements read them, and they only change when a
   * market is created or settles.
   */

  private async fetchRawMarkets(p: {
    outcome_id?: number;
    class?: string;
    underlying?: string;
    question_id?: number;
    limit?: number;
    offset?: number;
  } = {}): Promise<RawHip4Market[]> {
    const raw = await cacheService.getOrSet(
      buildHypedexerCacheKey('hip4', 'markets', { ...p }),
      () => this.client.getMarkets<RawHip4Market[]>(p),
      baseListTtl
    );
    return asArray(raw);
  }

  private async fetchRawOutcomeTokens(): Promise<RawHip4OutcomeToken[]> {
    const raw = await cacheService.getOrSet(
      buildHypedexerCacheKey('hip4', 'outcome-tokens'),
      () => this.client.getOutcomeTokens<RawHip4OutcomeToken[]>({}),
      baseListTtl
    );
    return asArray(raw);
  }

  private async fetchRawQuestions(p: { question_id?: number } = {}): Promise<RawHip4Question[]> {
    const raw = await cacheService.getOrSet(
      buildHypedexerCacheKey('hip4', 'questions', { ...p }),
      () => this.client.getQuestions<RawHip4Question[]>(p),
      baseListTtl
    );
    return asArray(raw);
  }
}

function asArray<T>(raw: unknown): T[] {
  return Array.isArray(raw) ? (raw as T[]) : [];
}

/** An empty list is more likely an upstream hiccup than the truth: retry it sooner. */
function baseListTtl(rows: unknown): number {
  return Array.isArray(rows) && rows.length > 0 ? HYPEDEXER_TTL.hip4BaseList : HYPEDEXER_TTL.hip4BaseListRetry;
}

/** A settled market's row is final; an open one changes; an unknown id may be a market about to be listed. */
function marketRowTtl(rows: RawHip4Market[]): number {
  if (rows.length === 0) return HYPEDEXER_TTL.hip4BaseListRetry;
  return rows.some((m) => Boolean(m.settled ?? m.is_settled))
    ? HYPEDEXER_TTL.hip4SettledMarket
    : HYPEDEXER_TTL.hip4OpenMarket;
}
