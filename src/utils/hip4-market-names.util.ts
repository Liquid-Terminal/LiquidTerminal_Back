/**
 * Readable names for HIP-4 markets whose raw name is not a title.
 *
 * - Templates. Since 2026-09 most markets are deployed from a Hyperliquid
 *   template and carry a reference instead of prose: name
 *   `template:binaryPrice`, description
 *   `perp:HYPE|priceDescription:HYPE-USDC perp mark|seconds:60|threshold:90.416|time:20260928-1200`,
 *   sides `template:Yes` / `template:{shortNameA}`. Hyperliquid's registry
 *   (POST /info {"type":"outcomeTemplates"}) holds each template's title and
 *   rules as formats over those keywords: `{perp} above {threshold} at {time}?`.
 * - Recurring price buckets. A `class:priceBucket|…|priceThresholds:77991,81174`
 *   question has outcomes named "Recurring Named Outcome" whose description is
 *   `index:N`: the name is the N-th price range.
 *
 * No I/O: the service fetches and caches the registry.
 */

export interface Hip4OutcomeTemplate {
  id: string;
  /** Title format, e.g. `{perp} above {threshold} at {time}?`. */
  name: string;
  /** Rules format. */
  description: string;
  /** Keyword → registry type (`dateTime`, `uDecimal`, `hlPerp`, `string`…). */
  keywordTypes: Record<string, string>;
}

export type Hip4TemplateIndex = ReadonlyMap<string, Hip4OutcomeTemplate>;

export const EMPTY_TEMPLATE_INDEX: Hip4TemplateIndex = new Map();

const TEMPLATE_PREFIX = 'template:';
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Index the raw `outcomeTemplates` answer by id; malformed entries are skipped. */
export function indexOutcomeTemplates(raw: unknown): Hip4TemplateIndex {
  const index = new Map<string, Hip4OutcomeTemplate>();
  if (!Array.isArray(raw)) return index;
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const { id, name, description, keywords } = entry as Record<string, unknown>;
    if (typeof id !== 'string' || typeof name !== 'string') continue;
    const keywordTypes: Record<string, string> = {};
    if (Array.isArray(keywords)) {
      for (const k of keywords) {
        if (Array.isArray(k) && typeof k[0] === 'string' && typeof k[1] === 'string') keywordTypes[k[0]] = k[1];
      }
    }
    index.set(id, { id, name, description: typeof description === 'string' ? description : '', keywordTypes });
  }
  return index;
}

/** `key:value|key:value` fields of a structured description. Values may hold `:`. */
export function parseDescriptionFields(description: string | null | undefined): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!description) return fields;
  for (const part of description.split('|')) {
    const i = part.indexOf(':');
    if (i <= 0) continue;
    fields[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return fields;
}

/** `binaryPrice` for `template:binaryPrice`; null for any other name. */
export function templateIdOf(name: string | null | undefined): string | null {
  const n = (name ?? '').trim();
  if (!n.startsWith(TEMPLATE_PREFIX)) return null;
  return n.slice(TEMPLATE_PREFIX.length).trim() || null;
}

/** The residual outcome of a question deployed from a template. */
export function isTemplateFallbackName(name: string | null | undefined): boolean {
  return (name ?? '').trim().toLowerCase() === 'template fallback';
}

/**
 * True for names that do not describe the market: empty, a deployer
 * placeholder, a template reference, or the coin label itself.
 */
export function isPlaceholderName(name: string | null | undefined, coin?: string | null): boolean {
  const n = (name ?? '').trim();
  if (!n) return true;
  if (coin && n === coin.trim()) return true;
  const lower = n.toLowerCase();
  return lower === 'recurring' || lower === 'recurring named outcome' || lower.startsWith('template');
}

/** `20260928-1200` → `Sep 28, 12:00 PM UTC` (template and expiry times are UTC). */
export function formatHip4DateTime(value: string): string | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})$/);
  if (!m) return null;
  const month = MONTHS_SHORT[parseInt(m[2], 10) - 1];
  const hh = parseInt(m[4], 10);
  if (!month || hh > 23) return null;
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${month} ${parseInt(m[3], 10)}, ${h12}:${m[5]} ${hh < 12 ? 'AM' : 'PM'} UTC`;
}

/** Thousands separators from 1 000 up; smaller values keep their digits. */
export function formatHip4Number(value: string | number): string {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (Math.abs(n) < 1000) return typeof value === 'number' ? String(value) : value.trim();
  return n.toLocaleString('en-US', { maximumFractionDigits: 8 });
}

function formatKeyword(value: string, type: string | undefined): string {
  if (type === 'dateTime') return formatHip4DateTime(value) ?? value;
  if (type === 'uDecimal') return formatHip4Number(value);
  return value;
}

/**
 * Fill the `{keyword}` placeholders of a template format. Null when a
 * placeholder has no value, so a caller never shows half a title.
 */
export function renderTemplateFormat(
  format: string,
  values: Record<string, string>,
  keywordTypes: Record<string, string> = {}
): string | null {
  let missing = false;
  const out = format.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = values[key];
    if (value == null || value === '') {
      missing = true;
      return '';
    }
    return formatKeyword(value, keywordTypes[key]);
  });
  if (missing) return null;
  // Rules formats write "{scheduledStart} UTC"; a rendered time already ends in UTC.
  const text = out.replace(/\bUTC(?:\s+UTC)+\b/g, 'UTC').trim();
  return text || null;
}

/** A templated outcome or question's title, e.g. `HYPE above 90.416 at Sep 28, 12:00 PM UTC?`. */
export function renderTemplateTitle(
  name: string | null | undefined,
  description: string | null | undefined,
  templates: Hip4TemplateIndex
): string | null {
  if (isTemplateFallbackName(name)) return 'Other';
  const id = templateIdOf(name);
  const template = id ? templates.get(id) : undefined;
  if (!template) return null;
  return renderTemplateFormat(template.name, parseDescriptionFields(description), template.keywordTypes);
}

/** A templated outcome or question's resolution rules, rendered from the registry. */
export function renderTemplateRules(
  name: string | null | undefined,
  description: string | null | undefined,
  templates: Hip4TemplateIndex
): string | null {
  const id = templateIdOf(name);
  const template = id ? templates.get(id) : undefined;
  if (!template?.description) return null;
  return renderTemplateFormat(template.description, parseDescriptionFields(description), template.keywordTypes);
}

/**
 * A side name: `template:Yes` → `Yes`, `template:{shortNameA}` → the
 * outcome's `shortNameA`. Plain names are kept; null when unrenderable.
 */
export function renderSideName(side: string, description: string | null | undefined): string | null {
  const s = side.trim();
  if (!s.startsWith(TEMPLATE_PREFIX)) return s || null;
  return renderTemplateFormat(s.slice(TEMPLATE_PREFIX.length), parseDescriptionFields(description));
}

export interface Hip4PriceFields {
  cls: string;
  underlying: string;
  targetPrice: number | null;
  expiry: string | null;
}

/**
 * Class / underlying / strike / expiry of the price templates, so templated
 * price markets chart, badge and expire like the older
 * `class:priceBinary|underlying:…` ones. External feeds (`binaryPriceExternal`)
 * are left out: their instrument is not a Hyperliquid perp to chart.
 */
export function templatePriceFields(
  name: string | null | undefined,
  description: string | null | undefined
): Hip4PriceFields | null {
  const id = templateIdOf(name);
  if (id !== 'binaryPrice' && id !== 'priceTouch') return null;
  const f = parseDescriptionFields(description);
  if (!f.perp) return null;
  const strike = Number(id === 'binaryPrice' ? f.threshold : f.target);
  return {
    cls: id === 'binaryPrice' ? 'priceBinary' : 'priceTouch',
    underlying: f.perp,
    targetPrice: Number.isFinite(strike) ? strike : null,
    expiry: f.time && /^\d{8}-\d{4}$/.test(f.time) ? f.time : null,
  };
}

interface PriceBucketQuestion {
  underlying: string;
  expiry: string | null;
  thresholds: number[];
}

/** `class:priceBucket|underlying:BTC|expiry:…|priceThresholds:77991,81174|period:1d`. */
function parsePriceBucketQuestion(description: string | null | undefined): PriceBucketQuestion | null {
  const f = parseDescriptionFields(description);
  if (f.class !== 'priceBucket' || !f.underlying || !f.priceThresholds) return null;
  const thresholds = f.priceThresholds.split(',').map((t) => Number(t.trim()));
  if (thresholds.length === 0 || !thresholds.every(Number.isFinite)) return null;
  return { underlying: f.underlying, expiry: f.expiry || null, thresholds };
}

/** `BTC price at May 9, 6:00 AM UTC` for a recurring price-bucket question. */
export function priceBucketQuestionTitle(questionDescription: string | null | undefined): string | null {
  const q = parsePriceBucketQuestion(questionDescription);
  if (!q) return null;
  const at = q.expiry ? formatHip4DateTime(q.expiry) : null;
  return at ? `${q.underlying} price at ${at}` : `${q.underlying} price`;
}

/**
 * The range an `index:N` outcome of a price-bucket question stands for:
 * `BTC < 77,991`, `BTC 77,991–81,174`, `BTC ≥ 81,174`.
 */
export function priceBucketOutcomeName(
  questionDescription: string | null | undefined,
  outcomeDescription: string | null | undefined
): string | null {
  const q = parsePriceBucketQuestion(questionDescription);
  const index = Number(parseDescriptionFields(outcomeDescription).index);
  if (!q || !Number.isInteger(index) || index < 0 || index > q.thresholds.length) return null;
  const t = q.thresholds.map((x) => formatHip4Number(x));
  if (index === 0) return `${q.underlying} < ${t[0]}`;
  if (index === q.thresholds.length) return `${q.underlying} ≥ ${t[index - 1]}`;
  return `${q.underlying} ${t[index - 1]}–${t[index]}`;
}

/** Expiry of a price-bucket question (`20260509-0600`), for its outcomes. */
export function priceBucketExpiry(questionDescription: string | null | undefined): string | null {
  return parsePriceBucketQuestion(questionDescription)?.expiry ?? null;
}

/** Underlying of a price-bucket question, for its outcomes. */
export function priceBucketUnderlying(questionDescription: string | null | undefined): string | null {
  return parsePriceBucketQuestion(questionDescription)?.underlying ?? null;
}
