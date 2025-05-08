import { z } from 'zod';

export const vaultsQuerySchema = z.object({
  query: z.object({
    sortBy: z.enum(['apr', 'tvl', 'createTime']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    limit: z.string()
      .transform(Number)
      .refine(n => n > 0 && n <= 100, 'Limit must be between 1 and 100')
      .optional(),
    page: z.string()
      .transform(Number)
      .refine(n => n > 0, 'Page must be greater than 0')
      .optional(),
    name: z.string().optional(),
    leader: z.string().optional(),
    isClosed: z.string()
      .transform(val => val === 'true')
      .optional()
  })
}); 