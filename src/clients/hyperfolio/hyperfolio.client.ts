import { BaseApiService, HttpApiError } from '../../core/base.api.service';
import { CircuitBreakerService } from '../../core/circuit.breaker.service';
import { RateLimiterService } from '../../core/hyperLiquid.ratelimiter.service';
import { logDeduplicator } from '../../utils/logDeduplicator';
import { maskSensitiveUrl } from '../../utils/url-masking';
import {
  HYPERFOLIO_API_KEY,
  HYPERFOLIO_API_URL,
  hyperfolioJsonHeaders,
  isHyperfolioConfigured,
} from './hyperfolio-api.config';
import {
  HyperfolioBadInputError,
  HyperfolioNotConfiguredError,
  HyperfolioRateLimitedError,
  HyperfolioUnauthorizedError,
  HyperfolioUpstreamError,
} from '../../errors/hyperfolio.errors';
import {
  HyperfolioCompositionResponse,
  HyperfolioErrorBody,
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

/** Cold `/wallet/transactions` fetches were measured at 33 s upstream. */
const TRANSACTIONS_TIMEOUT_MS = 45_000;

/** Upstream burst limit answers 403 with this message (not 429). */
const BURST_LIMIT_MESSAGE = /limit exceeded/i;

/**
 * Single-flight map: identical GETs issued while one is in-flight share the
 * same promise so a page that mounts several panels at once does not fan out
 * into duplicate upstream calls (same idea as HypeDexerBaseClient).
 */
const inFlight: Map<string, Promise<unknown>> = new Map();

/** Serialise query values, repeating array params (`categories=a&categories=b`). */
export function buildHyperfolioQuery(
  params: Record<string, string | number | boolean | string[] | undefined>
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      value.forEach((item) => search.append(key, String(item)));
    } else {
      search.append(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

function isErrorBody(payload: unknown): payload is HyperfolioErrorBody {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    typeof (payload as { error?: unknown }).error === 'string'
  );
}

/**
 * Hyperfolio REST client (HyperEVM wallet analytics + ecosystem yields).
 * On-demand only, no polling: every read goes through the service cache.
 */
export class HyperfolioClient extends BaseApiService {
  private static instance: HyperfolioClient;
  private static readonly REQUEST_WEIGHT = 10;
  private static readonly MAX_WEIGHT_PER_MINUTE = 300;

  private circuitBreaker: CircuitBreakerService;
  private rateLimiter: RateLimiterService;

  private constructor() {
    super(HYPERFOLIO_API_URL, hyperfolioJsonHeaders);
    this.circuitBreaker = CircuitBreakerService.getInstance('hyperfolio', {
      maxFailures: 5,
      resetTimeout: 30_000,
    });
    this.rateLimiter = RateLimiterService.getInstance('hyperfolio', {
      maxWeightPerMinute: HyperfolioClient.MAX_WEIGHT_PER_MINUTE,
      requestWeight: HyperfolioClient.REQUEST_WEIGHT,
    });
  }

  public static getInstance(): HyperfolioClient {
    if (!HyperfolioClient.instance) {
      HyperfolioClient.instance = new HyperfolioClient();
    }
    return HyperfolioClient.instance;
  }

  public checkRateLimit(ip: string): boolean {
    return this.rateLimiter.checkRateLimit(ip);
  }

  /** Translate transport failures into Hyperfolio domain errors. */
  public static toDomainError(error: unknown): Error {
    if (error instanceof HttpApiError) {
      if (error.statusCode === 429) return new HyperfolioRateLimitedError();
      if (error.statusCode === 403 && BURST_LIMIT_MESSAGE.test(error.responseBody ?? '')) {
        return new HyperfolioRateLimitedError();
      }
      if (error.statusCode === 401) return new HyperfolioUnauthorizedError();
      if (error.statusCode === 400) return new HyperfolioBadInputError();
      return new HyperfolioUpstreamError(`Hyperfolio answered ${error.statusCode}`);
    }
    if (error instanceof HyperfolioRateLimitedError || error instanceof HyperfolioBadInputError) {
      return error;
    }
    return new HyperfolioUpstreamError(error instanceof Error ? error.message : String(error));
  }

  private assertConfigured(): void {
    if (!isHyperfolioConfigured()) {
      throw new HyperfolioNotConfiguredError();
    }
  }

  /**
   * GET through the circuit breaker with single-flight dedup. A 200 whose
   * body carries `error` (bad address, unresolvable domain) is a 400 for us.
   * The burst 403 is retried once after a short pause before giving up.
   */
  private async getPath<T>(path: string, timeoutMs?: number): Promise<T> {
    this.assertConfigured();
    const key = `GET ${path}`;
    const existing = inFlight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = (async (): Promise<T> => {
      try {
        return await this.circuitBreaker.execute(async () => {
          logDeduplicator.info('HyperfolioClient', { path: maskSensitiveUrl(path) });
          const payload = await this.getWithBurstRetry<unknown>(path, timeoutMs);
          if (isErrorBody(payload)) {
            throw new HyperfolioBadInputError(payload.error);
          }
          return payload as T;
        });
      } catch (error) {
        throw HyperfolioClient.toDomainError(error);
      }
    })();

    inFlight.set(key, promise);
    promise
      .finally(() => {
        inFlight.delete(key);
      })
      .catch(() => {
        // swallow — the original promise still rejects to the caller
      });
    return promise;
  }

  private async getWithBurstRetry<T>(path: string, timeoutMs?: number): Promise<T> {
    try {
      return timeoutMs
        ? await this.getSingleAttempt<T>(path, timeoutMs)
        : await this.get<T>(path);
    } catch (error) {
      const burst =
        error instanceof HttpApiError &&
        error.statusCode === 403 &&
        BURST_LIMIT_MESSAGE.test(error.responseBody ?? '');
      if (!burst) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1_100));
      return timeoutMs
        ? this.getSingleAttempt<T>(path, timeoutMs)
        : this.getSingleAttempt<T>(path);
    }
  }

  /** `GET /wallet/composition` — HyperEVM token balances. */
  public getComposition(address: string): Promise<HyperfolioCompositionResponse> {
    return this.getPath<HyperfolioCompositionResponse>(
      `/wallet/composition${buildHyperfolioQuery({ address })}`
    );
  }

  /** `GET /positions` — DeFi positions grouped by protocol (blocking variant). */
  public getPositions(address: string): Promise<HyperfolioPositionsResponse> {
    return this.getPath<HyperfolioPositionsResponse>(
      `/positions${buildHyperfolioQuery({ address })}`,
      60_000
    );
  }

  /** `GET /portfolio-history` — daily net-worth snapshots (0x address only). */
  public getPortfolioHistory(address: string, days: number): Promise<HyperfolioPortfolioHistoryResponse> {
    return this.getPath<HyperfolioPortfolioHistoryResponse>(
      `/portfolio-history${buildHyperfolioQuery({ address, days })}`
    );
  }

  /** `GET /wallet/transactions` — decoded EVM transactions, paginated. */
  public getTransactions(
    address: string,
    query: HyperfolioTransactionsQuery
  ): Promise<HyperfolioTransactionsResponse> {
    return this.getPath<HyperfolioTransactionsResponse>(
      `/wallet/transactions${buildHyperfolioQuery({ address, ...query })}`,
      TRANSACTIONS_TIMEOUT_MS
    );
  }

  /** `GET /nfts` — wallet NFTs sorted by price, paginated. */
  public getNfts(address: string, query: HyperfolioNftsQuery): Promise<HyperfolioNftsResponse> {
    return this.getPath<HyperfolioNftsResponse>(`/nfts${buildHyperfolioQuery({ address, ...query })}`);
  }

  /** `GET /points` — farming points per protocol. */
  public getPoints(address: string): Promise<HyperfolioPointsResponse> {
    return this.getPath<HyperfolioPointsResponse>(`/points${buildHyperfolioQuery({ address })}`);
  }

  /** `GET /yield` — ecosystem yield opportunities with filters, sort and pagination. */
  public getYield(query: HyperfolioYieldQuery): Promise<HyperfolioYieldResponse> {
    return this.getPath<HyperfolioYieldResponse>(`/yield${buildHyperfolioQuery({ ...query })}`);
  }

  /**
   * `GET /positions/stream` — opens the upstream SSE connection and hands the
   * raw body back to the caller, which is responsible for piping and closing.
   * Bypasses BaseApiService (JSON-only) on purpose; the key is still attached.
   */
  public async openPositionsStream(
    address: string,
    signal: AbortSignal
  ): Promise<ReadableStream<Uint8Array>> {
    this.assertConfigured();
    const url = `${HYPERFOLIO_API_URL}/positions/stream${buildHyperfolioQuery({ address })}`;
    let response: globalThis.Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        signal,
        headers: {
          Accept: 'text/event-stream',
          'User-Agent': hyperfolioJsonHeaders['User-Agent'],
          'x-api-key': HYPERFOLIO_API_KEY ?? '',
        },
      });
    } catch (error) {
      throw HyperfolioClient.toDomainError(error);
    }
    if (!response.ok || !response.body) {
      const body = await response.text().catch(() => '');
      throw HyperfolioClient.toDomainError(
        new HttpApiError(`API error: ${response.status}`, response.status, body)
      );
    }
    return response.body;
  }
}
