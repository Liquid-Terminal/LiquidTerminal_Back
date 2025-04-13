import { z } from 'zod';

/**
 * Schéma de validation pour les requêtes de tendances des marchés perp
 */
export const marketPerpTrendingQuerySchema = z.object({
  query: z.object({
    sortBy: z.enum(['volume', 'openInterest', 'change24h']).default('openInterest'),
    limit: z.string().transform(val => Math.min(Number(val) || 5, 100)).default('5')
  }),
  params: z.object({}),
  body: z.object({})
});

/**
 * Schéma de validation pour les requêtes de marchés perp
 */
export const marketPerpQuerySchema = z.object({
  query: z.object({}),
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