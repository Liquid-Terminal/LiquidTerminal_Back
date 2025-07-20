import { z } from 'zod';

/**
 * Schéma de validation pour les requêtes de leaderboard (validation manuelle)
 */
export const leaderboardQuerySchema = z.object({
  timeline: z.enum(['day', 'week', 'month', 'allTime']).optional().default('day'),
  sortBy: z.enum(['pnl', 'roi', 'vlm']).optional().default('pnl'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20)
});

/**
 * Schéma de validation pour les requêtes de leaderboard (GET avec middleware)
 */
export const leaderboardGetSchema = z.object({
  query: z.object({
    timeline: z.enum(['day', 'week', 'month', 'allTime']).optional().default('day'),
    sortBy: z.enum(['pnl', 'roi', 'vlm']).optional().default('pnl'),
    order: z.enum(['asc', 'desc']).optional().default('desc'),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20)
  }),
  params: z.object({})
});

export type LeaderboardQueryInput = z.infer<typeof leaderboardQuerySchema>; 