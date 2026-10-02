import { z } from 'zod';

/**
 * Rule types stored in the generic AlertRule table. Each type has a zod schema
 * for its `params`; the API validates with it and the engine trusts the
 * stored shape. Adding a type = a schema here + a matcher in a pipeline.
 */

const coin = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[A-Za-z0-9:_-]+$/, 'Invalid coin')
  .transform((c) => c.toUpperCase());
const optionalCoin = coin.nullable().default(null);
const pct = (max: number) => z.coerce.number().positive().max(max);

export const ALERT_RULE_SCHEMAS = {
  /** Price crosses a level (perp mark price). */
  price_cross: z
    .object({ coin, level: z.coerce.number().positive().max(1e12), direction: z.enum(['above', 'below']) })
    .strict(),
  /** Price moves by at least `pct` % over the window (any coin when coin is null). */
  price_move: z
    .object({
      coin: optionalCoin,
      pct: pct(1000),
      window: z.enum(['1h', '24h']),
      direction: z.enum(['up', 'down', 'both']).default('both'),
    })
    .strict(),
  /** Funding beyond an annualized rate, either side. */
  funding: z.object({ coin: optionalCoin, aprPct: pct(100_000) }).strict(),
  /** Open interest (USD) up at least `pct` % over the last hour. */
  oi_surge: z
    .object({ coin: optionalCoin, pct: pct(10_000), minOiUsd: z.coerce.number().min(0).max(1e12).default(1_000_000) })
    .strict(),
  /** A new perp market goes live. */
  listing: z.object({}).strict(),
  /** A market's maximum leverage changes. */
  leverage: z.object({ coin: optionalCoin }).strict(),
  /** Liquidations totalling at least `minUsd` within 60 seconds, on a coin or market-wide. */
  liq_cascade: z.object({ coin: optionalCoin, minUsd: z.coerce.number().min(10_000).max(1e12) }).strict(),
} as const;

export type AlertRuleType = keyof typeof ALERT_RULE_SCHEMAS;
export const ALERT_RULE_TYPES = Object.keys(ALERT_RULE_SCHEMAS) as AlertRuleType[];

export type AlertRuleParams = {
  [K in AlertRuleType]: z.infer<(typeof ALERT_RULE_SCHEMAS)[K]>;
};

/** Validate params for a type; throws a ZodError on bad input. */
export function parseRuleParams<T extends AlertRuleType>(type: T, params: unknown): AlertRuleParams[T] {
  return ALERT_RULE_SCHEMAS[type].parse(params ?? {}) as AlertRuleParams[T];
}

export const isAlertRuleType = (t: unknown): t is AlertRuleType =>
  typeof t === 'string' && (ALERT_RULE_TYPES as string[]).includes(t);

const usd = (v: number) =>
  v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${v}`;

/** Readable default name, used when the user gives none. */
export function defaultRuleName(type: AlertRuleType, params: AlertRuleParams[AlertRuleType]): string {
  const p = params as Record<string, unknown>;
  const where = (p.coin as string | null) ?? 'Any coin';
  switch (type) {
    case 'price_cross':
      return `${where} ${p.direction} $${(p.level as number).toLocaleString('en-US', { maximumSignificantDigits: 8 })}`;
    case 'price_move':
      return `${where} ${p.direction === 'both' ? '±' : p.direction === 'up' ? '+' : '-'}${p.pct}% in ${p.window}`;
    case 'funding':
      return `${where} funding beyond ${p.aprPct}% APR`;
    case 'oi_surge':
      return `${where} OI +${p.pct}% in 1h`;
    case 'listing':
      return 'New perp listings';
    case 'leverage':
      return `${where} max leverage changes`;
    case 'liq_cascade':
      return `${(p.coin as string | null) ?? 'Market-wide'} liquidations ${usd(p.minUsd as number)}+ in 60s`;
  }
}

/** Rules one user can hold, across all types. */
export const MAX_ALERT_RULES_PER_USER = 25;
