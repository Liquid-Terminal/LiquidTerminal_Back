import { z } from 'zod';

/**
 * Hyperfolio proxy validation (GET-only): query/params only, never `body`.
 * validateGetRequest only checks the request — coercion/defaults are applied
 * again by the parse helpers in the routes.
 */

const ETH_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
/** `.hype` / `.hl` names accepted by every wallet endpoint except history. */
const HL_NAME = /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?\.(hype|hl)$/i;

const ethAddress = z.string().regex(ETH_ADDRESS, 'Invalid Ethereum address');
const walletInput = z
  .string()
  .min(1)
  .max(128)
  .refine((v) => ETH_ADDRESS.test(v) || HL_NAME.test(v), 'Expected a 0x address, a .hype or a .hl name');

/**
 * A real calendar day (not just the YYYY-MM-DD shape: `2024-99-99` used to go
 * straight upstream). Odd inputs are refused here rather than risking upstream
 * 5xx/timeouts that would count toward the shared circuit breaker.
 */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .refine((v) => {
    const time = Date.parse(`${v}T00:00:00Z`);
    return (
      Number.isFinite(time) &&
      new Date(time).toISOString().startsWith(v) &&
      v >= '2020-01-01' &&
      time <= Date.now() + 24 * 60 * 60 * 1000
    );
  }, 'Expected a valid date');

/** Accept `?k=a&k=b` (array) and `?k=a` (string) alike. */
const stringList = <T extends z.ZodType<string>>(item: T) =>
  z.union([item, z.array(item).max(20)]).transform((v) => (Array.isArray(v) ? v : [v]));

const slug = z.string().min(1).max(64).regex(/^[a-z0-9_.-]+$/i, 'Invalid identifier');
const symbol = z.string().min(1).max(32).regex(/^[A-Za-z0-9$₮._-]+$/, 'Invalid symbol');

export const hyperfolioWalletParamsSchema = z.object({
  query: z.object({}),
  params: z.object({ address: walletInput }),
});

export const hyperfolioHistorySchema = z.object({
  query: z.object({
    days: z.coerce.number().int().min(1).max(365).optional(),
  }),
  params: z.object({ address: ethAddress }),
});

/**
 * Page caps: deep pages are what makes upstream slow (cold scans) and each one
 * is a fresh cache miss. 500 × 100 transactions / 200 × 100 NFTs / 100 × 200
 * pools is far past anything the UI pages through.
 */
export const hyperfolioTransactionsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(500).optional(),
    offset: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().max(120).optional(),
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
    type: z.enum(['all', 'normal', 'token', 'internal']).optional(),
  })
  .refine((q) => !q.startDate || !q.endDate || q.startDate <= q.endDate, {
    message: 'startDate must not be after endDate',
    path: ['startDate'],
  });

export const hyperfolioTransactionsSchema = z.object({
  query: hyperfolioTransactionsQuerySchema,
  params: z.object({ address: walletInput }),
});

export const hyperfolioNftsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  collection: z.string().max(120).optional(),
});

export const hyperfolioNftsSchema = z.object({
  query: hyperfolioNftsQuerySchema,
  params: z.object({ address: walletInput }),
});

export const hyperfolioYieldQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100).optional(),
  page_size: z.coerce.number().int().min(1).max(200).optional(),
  search: z.string().max(120).optional(),
  categories: stringList(z.enum(['lending', 'amm', 'yield', 'staking', 'derivatives'])).optional(),
  protocols: stringList(slug).optional(),
  token_addresses: stringList(ethAddress).optional(),
  token_symbols: stringList(symbol).optional(),
  min_apy: z.coerce.number().min(0).max(1_000_000).optional(),
  max_apy: z.coerce.number().min(0).max(1_000_000).optional(),
  min_tvl: z.coerce.number().min(0).optional(),
  max_tvl: z.coerce.number().min(0).optional(),
  sort_by: z.enum(['apy', 'tvl', 'name']).optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
});

export const hyperfolioYieldSchema = z.object({
  query: hyperfolioYieldQuerySchema,
  params: z.object({}),
});

export type HyperfolioTransactionsQueryInput = z.infer<typeof hyperfolioTransactionsQuerySchema>;
export type HyperfolioNftsQueryInput = z.infer<typeof hyperfolioNftsQuerySchema>;
export type HyperfolioYieldQueryInput = z.infer<typeof hyperfolioYieldQuerySchema>;
