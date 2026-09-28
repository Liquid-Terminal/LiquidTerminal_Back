import { z } from 'zod';

const noParams = z.object({});

const days = z.coerce.number().int().min(1).max(60).default(14);

/** GET /elysium/analytics/status */
export const elysiumAnalyticsStatusSchema = z.object({
  query: z.object({}),
  params: noParams,
});

/** GET /elysium/analytics/{deployments,users,bridge,economics}?days=1..60 (default 14) */
export const elysiumAnalyticsDaysSchema = z.object({
  query: z.object({ days }),
  params: noParams,
});

/** GET /elysium/analytics/contracts?window=24h|7d (default 24h) */
export const elysiumAnalyticsContractsSchema = z.object({
  query: z.object({ window: z.enum(['24h', '7d']).default('24h') }),
  params: noParams,
});

export type ElysiumAnalyticsDaysQuery = z.infer<typeof elysiumAnalyticsDaysSchema>['query'];
export type ElysiumAnalyticsContractsQuery = z.infer<typeof elysiumAnalyticsContractsSchema>['query'];
