import { HypurrscanTokenHoldersClient } from '../../clients/hypurrscan/tokenHolders.client';
import { redisService } from '../../core/redis.service';
import { MarketData } from '../../types/market.types';
import { logDeduplicator } from '../../utils/logDeduplicator';
import { OnDemandSnapshot } from '../../utils/onDemandSnapshot';
import {
  buildTokenHoldersView,
  HolderCohort,
  TokenHolderRow,
  TokenHoldersView,
} from '../../utils/token-holders.util';

export interface TokenHoldersPage {
  token: string;
  lastUpdate: number;
  holdersCount: number;
  totalBalance: number;
  holders: TokenHolderRow[];
  pagination: {
    page: number;
    limit: number;
    /** Rows that can be paged through (the largest MAX_ROWS holders). */
    total: number;
    totalPages: number;
  };
  cohorts: HolderCohort[];
}

export class UnknownTokenError extends Error {
  constructor(token: string) {
    super(`Unknown spot token: ${token}`);
    this.name = 'UnknownTokenError';
  }
}

export class HoldersUnavailableError extends Error {
  constructor(token: string) {
    super(`Holders unavailable for ${token}`);
    this.name = 'HoldersUnavailableError';
  }
}

/**
 * Spot token holders, aggregated server-side. The browser used to download
 * the whole Hypurrscan lists (HYPE: 17.7 MB with the staked one, USDC ~70 MB)
 * to show one page of ten rows, a holder count and five cohorts; it now gets
 * exactly that.
 *
 * One view per token, built once per upstream download and held in memory
 * while someone reads it (OnDemandSnapshot). Only the largest MAX_ROWS holders
 * are kept for paging — counts, total and cohorts still cover every holder.
 */
export class TokenHoldersService {
  private static instance: TokenHoldersService;

  /** Hypurrscan regenerates the lists every ~10 min. */
  private static readonly FRESH_MS = 3 * 60_000;
  private static readonly MAX_STALE_MS = 15 * 60_000;
  /** Largest holders kept per token (1,000 pages of 10). */
  public static readonly MAX_ROWS = 10_000;
  /** Tokens whose view is held at once; the least recently read one goes first. */
  private static readonly MAX_TOKENS = 8;

  private static readonly MARKETS_CACHE_KEY = 'spot:markets';
  private static readonly KNOWN_TOKENS_TTL_MS = 60_000;

  private readonly client = HypurrscanTokenHoldersClient.getInstance();
  private readonly views = new Map<string, OnDemandSnapshot<TokenHoldersView>>();
  /** Lowercased name → listed name. */
  private knownTokens: { names: Map<string, string>; loadedAt: number } | null = null;

  private constructor() {}

  public static getInstance(): TokenHoldersService {
    if (!TokenHoldersService.instance) {
      TokenHoldersService.instance = new TokenHoldersService();
    }
    return TokenHoldersService.instance;
  }

  /** One page of a token's holders, largest first (`page` starts at 1). */
  public async getHoldersPage(token: string, page: number, limit: number): Promise<TokenHoldersPage> {
    const name = await this.resolveToken(token);
    if (!name) {
      throw new UnknownTokenError(token);
    }

    const view = await this.viewOf(name).get();
    if (!view) {
      throw new HoldersUnavailableError(name);
    }

    const total = view.top.length;
    const start = (page - 1) * limit;
    return {
      token: view.token,
      lastUpdate: view.lastUpdate,
      holdersCount: view.holdersCount,
      totalBalance: view.totalBalance,
      holders: view.top.slice(start, start + limit),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      cohorts: view.cohorts,
    };
  }

  private viewOf(token: string): OnDemandSnapshot<TokenHoldersView> {
    let snapshot = this.views.get(token);
    if (snapshot) {
      // Re-insert: Map order is the recency order.
      this.views.delete(token);
    } else {
      snapshot = new OnDemandSnapshot(() => this.fetchView(token), {
        freshMs: TokenHoldersService.FRESH_MS,
        maxStaleMs: TokenHoldersService.MAX_STALE_MS,
      });
    }
    this.views.set(token, snapshot);

    while (this.views.size > TokenHoldersService.MAX_TOKENS) {
      const [oldest, evicted] = this.views.entries().next().value as [string, OnDemandSnapshot<TokenHoldersView>];
      evicted.clear();
      this.views.delete(oldest);
    }
    return snapshot;
  }

  private async fetchView(token: string): Promise<TokenHoldersView> {
    try {
      const [spot, staked] = await Promise.all([
        this.client.getHolders(token),
        this.client.getStakedHolders(token),
      ]);
      const view = buildTokenHoldersView(token, spot, staked, TokenHoldersService.MAX_ROWS);
      logDeduplicator.info('Token holders view built', { token, holders: view.holdersCount });
      return view;
    } catch (error) {
      logDeduplicator.error('Failed to fetch token holders', {
        token,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * The listed spot token's name, matched case-insensitively like the token
   * page does ("hype" → "HYPE"), or null. Only listed tokens are fetched, so a
   * crafted name can't make this process download arbitrary paths. Fails open
   * (shape check only, done by the route) while the spot poller hasn't filled
   * Redis yet.
   */
  private async resolveToken(token: string): Promise<string | null> {
    const now = Date.now();
    if (!this.knownTokens || now - this.knownTokens.loadedAt > TokenHoldersService.KNOWN_TOKENS_TTL_MS) {
      try {
        const raw = await redisService.get(TokenHoldersService.MARKETS_CACHE_KEY);
        if (raw) {
          const markets = JSON.parse(raw) as MarketData[];
          this.knownTokens = {
            names: new Map(markets.map((m) => [m.name.toLowerCase(), m.name])),
            loadedAt: now,
          };
        }
      } catch (error) {
        logDeduplicator.warn('TokenHoldersService: failed to load the spot markets', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    if (!this.knownTokens) return token;
    return this.knownTokens.names.get(token.toLowerCase()) ?? null;
  }
}
