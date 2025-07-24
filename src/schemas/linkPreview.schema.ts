import { z } from 'zod';

// Schéma de validation pour les URLs
const urlSchema = z.string()
  .url('Format d\'URL invalide')
  .max(500, 'L\'URL ne doit pas dépasser 500 caractères')
  .refine((url) => {
    try {
      const urlObj = new URL(url);
      return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }, 'URL doit utiliser le protocole HTTP ou HTTPS');

// Schéma pour la création de LinkPreview
export const linkPreviewCreateSchema = z.object({
  url: urlSchema
});

// Schéma pour la mise à jour de LinkPreview
export const linkPreviewUpdateSchema = z.object({
  title: z.string()
    .max(255, 'Le titre ne doit pas dépasser 255 caractères')
    .trim()
    .optional(),
  description: z.string()
    .max(500, 'La description ne doit pas dépasser 500 caractères')
    .trim()
    .optional(),
  image: z.string()
    .url('Format d\'URL d\'image invalide')
    .max(500, 'L\'URL de l\'image ne doit pas dépasser 500 caractères')
    .optional(),
  siteName: z.string()
    .max(100, 'Le nom du site ne doit pas dépasser 100 caractères')
    .trim()
    .optional(),
  favicon: z.string()
    .url('Format d\'URL de favicon invalide')
    .max(500, 'L\'URL du favicon ne doit pas dépasser 500 caractères')
    .optional()
});

// Schéma pour les requêtes de LinkPreview
export const linkPreviewQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
  sort: z.enum(['createdAt', 'updatedAt', 'title', 'siteName']).optional().default('createdAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
  search: z.string().max(100, 'Terme de recherche trop long').optional()
});

// Schéma pour les requêtes batch
export const linkPreviewBatchSchema = z.object({
  urls: z.array(urlSchema)
    .min(1, 'Au moins une URL est requise')
    .max(10, 'Maximum 10 URLs par requête')
});

// Schémas pour les middlewares de validation
export const linkPreviewGetSchema = z.object({
  query: z.object({
    url: urlSchema,
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
    sort: z.enum(['createdAt', 'updatedAt', 'title', 'siteName']).optional().default('createdAt'),
    order: z.enum(['asc', 'desc']).optional().default('desc'),
    search: z.string().max(100, 'Terme de recherche trop long').optional()
  }),
  params: z.object({})
});

export const linkPreviewListSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
    sort: z.enum(['createdAt', 'updatedAt', 'title', 'siteName']).optional().default('createdAt'),
    order: z.enum(['asc', 'desc']).optional().default('desc'),
    search: z.string().max(100, 'Terme de recherche trop long').optional()
  }),
  params: z.object({})
});

export const linkPreviewBatchPostSchema = z.object({
  query: z.object({}),
  params: z.object({}),
  body: linkPreviewBatchSchema
});

export const linkPreviewByIdGetSchema = z.object({
  query: z.object({}),
  params: z.object({
    id: z.string().min(1, 'ID requis')
  })
}); 