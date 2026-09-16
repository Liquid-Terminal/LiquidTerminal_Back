/**
 * Hyperfolio REST configuration (https://api.hyperfolio.xyz).
 *
 * The API key is read from `HYPERFOLIO_API_KEY` and only ever leaves this
 * process as the `x-api-key` header on outbound requests. Unlike the HypeDexer
 * config, a missing key does not abort the boot: Hyperfolio powers optional
 * HyperEVM panels, so the rest of the API keeps serving and the Hyperfolio
 * routes answer 503 `HYPERFOLIO_NOT_CONFIGURED` instead.
 */
import pkg from '../../../package.json';

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function resolveHyperfolioApiKey(): string | null {
  const raw = (process.env.HYPERFOLIO_API_KEY || '').trim();
  if (!raw) {
    return process.env.NODE_ENV === 'test' ? 'test-key' : null;
  }
  return raw;
}

export const HYPERFOLIO_API_URL = normalizeBaseUrl(
  process.env.HYPERFOLIO_API_URL || 'https://api.hyperfolio.xyz'
);

/** Public host serving the relative protocol logos returned by `/positions`. */
export const HYPERFOLIO_ASSETS_URL = normalizeBaseUrl(
  process.env.HYPERFOLIO_ASSETS_URL || 'https://hyperfolio.xyz'
);

export const HYPERFOLIO_API_KEY: string | null = resolveHyperfolioApiKey();

export const isHyperfolioConfigured = (): boolean => HYPERFOLIO_API_KEY !== null;

const HYPERFOLIO_USER_AGENT = `liquidterminal-back/${pkg.version || '0.0.0'}`;

export const hyperfolioJsonHeaders: Record<string, string> = {
  Accept: 'application/json',
  'Accept-Encoding': 'gzip, deflate',
  'User-Agent': HYPERFOLIO_USER_AGENT,
  ...(HYPERFOLIO_API_KEY ? { 'x-api-key': HYPERFOLIO_API_KEY } : {}),
};
