import { BaseApiService } from '../../core/base.api.service';
import { CircuitBreakerService } from '../../core/circuit.breaker.service';
import { RawTokenHolders } from '../../utils/token-holders.util';

/**
 * Hypurrscan holder lists, fetched on demand by TokenHoldersService and
 * StakedHoldersService (no polling, nothing stored in Redis). These payloads
 * are huge — HYPE 14.9 MB, stakedHYPE 2.8 MB, USDC ~70 MB (2026-10) — so
 * downloads run one at a time: two parsed lists in memory at once is the peak
 * this process accepts.
 */
export class HypurrscanTokenHoldersClient extends BaseApiService {
  private static instance: HypurrscanTokenHoldersClient;
  private static readonly API_URL = process.env.HYPURRSCAN_API_URL || 'https://api.hypurrscan.io';

  private readonly circuitBreaker: CircuitBreakerService;
  private queue: Promise<unknown> = Promise.resolve();

  private constructor() {
    super(HypurrscanTokenHoldersClient.API_URL);
    this.circuitBreaker = CircuitBreakerService.getInstance('hypurrscan_token_holders');
  }

  public static getInstance(): HypurrscanTokenHoldersClient {
    if (!HypurrscanTokenHoldersClient.instance) {
      HypurrscanTokenHoldersClient.instance = new HypurrscanTokenHoldersClient();
    }
    return HypurrscanTokenHoldersClient.instance;
  }

  /** `/holders/{token}` — `{}` for a token Hypurrscan doesn't know. */
  public getHolders(token: string): Promise<RawTokenHolders> {
    return this.serial(`/holders/${encodeURIComponent(token)}`);
  }

  /** `/holders/staked{token}` — `{}` for a token nobody stakes. */
  public getStakedHolders(token: string): Promise<RawTokenHolders> {
    return this.serial(`/holders/staked${encodeURIComponent(token)}`);
  }

  private serial(path: string): Promise<RawTokenHolders> {
    const run = this.queue.then(() =>
      this.circuitBreaker.execute(() => this.get<RawTokenHolders>(path))
    );
    this.queue = run.catch(() => undefined);
    return run;
  }
}
