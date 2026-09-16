import { createHash } from 'crypto';
import { cacheService } from '../../core/cache.service';
import { redisService } from '../../core/redis.service';
import { logDeduplicator } from '../../utils/logDeduplicator';
import { HYPERFOLIO_CACHE_KEYS, HYPERFOLIO_TTL } from '../../constants/hyperfolio.cache';
import { HyperfolioRateLimitedError } from '../../errors/hyperfolio.errors';
import {
  HyperfolioCompositionResponse,
  HyperfolioNftsQuery,
  HyperfolioNftsResponse,
  HyperfolioPointsResponse,
  HyperfolioPortfolioHistoryResponse,
  HyperfolioPositionsResponse,
  HyperfolioTransactionsQuery,
  HyperfolioTransactionsResponse,
  HyperfolioYieldQuery,
  HyperfolioYieldResponse,
} from '../../types/hyperfolio.types';
import { HyperfolioClient } from '../../clients/hyperfolio/hyperfolio.client';

/** After an upstream throttle, short-circuit callers for this long. */
const RATE_LIMIT_COOLDOWN_MS = 10_000;

/** Stable, short signature for a query object (cache key suffix). */
function signature(query: object): string {
  const entries = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b));
  return createHash('sha1').update(JSON.stringify(entries)).digest('hex').slice(0, 16);
}

/**
 * Thin, Redis-cached service over HyperfolioClient. Every read is served from
 * cache for its TTL so a busy wallet page costs one upstream call per panel.
 */
export class HyperfolioService {
  private static instance: HyperfolioService;
  private readonly client = HyperfolioClient.getInstance();
  private rateLimitedUntil = 0;

  public static getInstance(): HyperfolioService {
    if (!HyperfolioService.instance) {
      HyperfolioService.instance = new HyperfolioService();
    }
    return HyperfolioService.instance;
  }

  /**
   * cacheService.getOrSet re-runs `fetchFn` after a failure; against a rate
   * limited upstream that doubles the damage, so a throttle opens a short
   * cooldown during which callers fail fast without touching Hyperfolio.
   */
  private async cached<T>(key: string, ttl: number, fetchFn: () => Promise<T>): Promise<T> {
    if (Date.now() < this.rateLimitedUntil) {
      throw new HyperfolioRateLimitedError();
    }
    return cacheService.getOrSet(key, async () => {
      if (Date.now() < this.rateLimitedUntil) {
        throw new HyperfolioRateLimitedError();
      }
      try {
        return await fetchFn();
      } catch (error) {
        if (error instanceof HyperfolioRateLimitedError) {
          this.rateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
          logDeduplicator.warn('Hyperfolio rate limited, cooling down', { key });
        }
        throw error;
      }
    }, ttl);
  }

  public getComposition(address: string): Promise<HyperfolioCompositionResponse> {
    return this.cached(
      HYPERFOLIO_CACHE_KEYS.composition(address),
      HYPERFOLIO_TTL.composition,
      () => this.client.getComposition(address)
    );
  }

  public getPositions(address: string): Promise<HyperfolioPositionsResponse> {
    return this.cached(
      HYPERFOLIO_CACHE_KEYS.positions(address),
      HYPERFOLIO_TTL.positions,
      () => this.client.getPositions(address)
    );
  }

  /** Cached positions if present, without touching upstream (stream replay). */
  public async peekPositions(address: string): Promise<HyperfolioPositionsResponse | null> {
    try {
      const raw = await redisService.get(HYPERFOLIO_CACHE_KEYS.positions(address));
      return raw ? (JSON.parse(raw) as HyperfolioPositionsResponse) : null;
    } catch {
      return null;
    }
  }

  /** Warm the positions cache from a fully consumed stream. */
  public async storePositions(address: string, payload: HyperfolioPositionsResponse): Promise<void> {
    try {
      await redisService.set(
        HYPERFOLIO_CACHE_KEYS.positions(address),
        JSON.stringify(payload),
        HYPERFOLIO_TTL.positions
      );
    } catch (error) {
      logDeduplicator.warn('Hyperfolio: failed to warm positions cache', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public isRateLimited(): boolean {
    return Date.now() < this.rateLimitedUntil;
  }

  public markRateLimited(): void {
    this.rateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
  }

  public getPortfolioHistory(address: string, days: number): Promise<HyperfolioPortfolioHistoryResponse> {
    return this.cached(
      HYPERFOLIO_CACHE_KEYS.history(address, days),
      HYPERFOLIO_TTL.history,
      () => this.client.getPortfolioHistory(address, days)
    );
  }

  public getTransactions(
    address: string,
    query: HyperfolioTransactionsQuery
  ): Promise<HyperfolioTransactionsResponse> {
    return this.cached(
      HYPERFOLIO_CACHE_KEYS.transactions(address, signature(query)),
      HYPERFOLIO_TTL.transactions,
      () => this.client.getTransactions(address, query)
    );
  }

  public getNfts(address: string, query: HyperfolioNftsQuery): Promise<HyperfolioNftsResponse> {
    return this.cached(
      HYPERFOLIO_CACHE_KEYS.nfts(address, signature(query)),
      HYPERFOLIO_TTL.nfts,
      () => this.client.getNfts(address, query)
    );
  }

  public getPoints(address: string): Promise<HyperfolioPointsResponse> {
    return this.cached(
      HYPERFOLIO_CACHE_KEYS.points(address),
      HYPERFOLIO_TTL.points,
      () => this.client.getPoints(address)
    );
  }

  public getYield(query: HyperfolioYieldQuery): Promise<HyperfolioYieldResponse> {
    return this.cached(
      HYPERFOLIO_CACHE_KEYS.yield(signature(query)),
      HYPERFOLIO_TTL.yield,
      () => this.client.getYield(query)
    );
  }
}
