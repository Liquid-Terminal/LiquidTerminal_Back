import { z } from 'zod';

export const categoryQuerySchema = z.object({
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().optional().default(10),
  sort: z.enum(['createdAt', 'name', 'updatedAt']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  search: z.string().max(100, 'Terme de recherche trop long').optional()
});

export const categoryCreateSchema = z.object({
  name: z.string()
    .min(2, 'Le nom doit contenir au moins 2 caractères')
    .max(100, 'Le nom ne doit pas dépasser 100 caractères')
    .trim()
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Le nom contient des caractères non autorisés'),
  
  description: z.string()
    .max(255, 'La description ne doit pas dépasser 255 caractères')
    .trim()
    .optional()
});

export const categoryUpdateSchema = categoryCreateSchema.partial(); 