/**
 * Hyperfolio proxy errors. Same plain-Error + statusCode + code pattern as
 * defillama.errors.ts so the route helper can map them 1:1 to HTTP.
 */
export class HyperfolioError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode = 502, code = 'HYPERFOLIO_ERROR') {
    super(message);
    this.name = 'HyperfolioError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/** `HYPERFOLIO_API_KEY` is not set on this instance. */
export class HyperfolioNotConfiguredError extends HyperfolioError {
  constructor(message = 'Hyperfolio integration is not configured') {
    super(message, 503, 'HYPERFOLIO_NOT_CONFIGURED');
  }
}

/**
 * Upstream throttled us. Hyperfolio answers 403 "Per-second request limit
 * exceeded" for the burst limit and 429 for quota limits; both surface as 429.
 */
export class HyperfolioRateLimitedError extends HyperfolioError {
  constructor(message = 'Hyperfolio rate limit reached, retry shortly') {
    super(message, 429, 'HYPERFOLIO_RATE_LIMITED');
  }
}

/**
 * Upstream rejected the input (HTTP 200 with a body-level `error`, or 400):
 * unsupported address form or an unresolvable .hype/.hl domain.
 */
export class HyperfolioBadInputError extends HyperfolioError {
  constructor(message = 'Unsupported address or unresolvable domain') {
    super(message, 400, 'HYPERFOLIO_BAD_INPUT');
  }
}

/** Upstream key rejected — misconfiguration on our side, not the caller's. */
export class HyperfolioUnauthorizedError extends HyperfolioError {
  constructor(message = 'Hyperfolio rejected the API key') {
    super(message, 502, 'HYPERFOLIO_UNAUTHORIZED');
  }
}

/** Upstream failed transiently or returned an unexpected status. */
export class HyperfolioUpstreamError extends HyperfolioError {
  constructor(message = 'Hyperfolio upstream error') {
    super(message, 502, 'HYPERFOLIO_UPSTREAM_ERROR');
  }
}
