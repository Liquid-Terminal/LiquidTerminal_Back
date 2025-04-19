import { z } from 'zod';

/**
 * Schéma de validation pour les requêtes de marchés perp
 */
export const marketPerpQuerySchema = z.object({
  query: z.object({
    token: z.string().optional(),
    pair: z.string().optional(),
    sortBy: z.enum(['volume', 'openInterest', 'change24h']).optional().default('volume'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
    limit: z.string().regex(/^\d+$/).transform(Number).refine(val => val > 0 && val <= 100, {
      message: 'Limit must be between 1 and 100'
    }).optional().default('20'),
    page: z.string().regex(/^\d+$/).transform(Number).refine(val => val >= 0, {
      message: 'Page must be a positive number'
    }).optional().default('0'),
  }),
  params: z.object({}),
  body: z.object({})
});

/**
 * Schéma de validation pour les requêtes de statistiques globales perp
 */
export const globalPerpStatsQuerySchema = z.object({
  query: z.object({}),
  params: z.object({}),
  body: z.object({})
}); 