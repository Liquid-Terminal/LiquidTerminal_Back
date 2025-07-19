import { z } from 'zod';

// Schémas de base pour les ReadLists
export const readListBaseSchema = z.object({
  name: z.string()
    .min(2, 'Le nom doit contenir au moins 2 caractères')
    .max(255, 'Le nom ne doit pas dépasser 255 caractères')
    .trim(),
  
  description: z.string()
    .max(500, 'La description ne doit pas dépasser 500 caractères')
    .trim()
    .optional(),
  
  isPublic: z.boolean().optional().default(false)
});

// Schéma pour la création de ReadList
export const readListCreateSchema = z.object({
  ...readListBaseSchema.shape,
  userId: z.number().int().positive('ID utilisateur invalide')
});

// Schéma pour la mise à jour de ReadList
export const readListUpdateSchema = readListBaseSchema.partial();

// Schéma pour les requêtes de ReadLists
export const readListQuerySchema = z.object({
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().max(100).optional().default(10),
  sort: z.enum(['createdAt', 'name', 'updatedAt']).optional().default('updatedAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
  search: z.string().max(100, 'Terme de recherche trop long').optional(),
  isPublic: z.boolean().optional(),
  userId: z.number().int().positive().optional()
});

// Schémas de base pour les ReadListItems
export const readListItemBaseSchema = z.object({
  notes: z.string()
    .max(1000, 'Les notes ne doivent pas dépasser 1000 caractères')
    .trim()
    .optional(),
  
  order: z.number().int().min(0).optional(),
  isRead: z.boolean().optional().default(false)
});

// Schéma pour la création de ReadListItem
export const readListItemCreateSchema = z.object({
  readListId: z.number().int().positive('ID read list invalide'),
  resourceId: z.number().int().positive('ID ressource invalide'),
  ...readListItemBaseSchema.shape
});

// Schéma pour la mise à jour de ReadListItem
export const readListItemUpdateSchema = readListItemBaseSchema.partial();

// Schéma pour les requêtes de ReadListItems
export const readListItemQuerySchema = z.object({
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().max(100).optional().default(10),
  sort: z.enum(['addedAt', 'order', 'isRead']).optional().default('addedAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
  isRead: z.boolean().optional(),
  search: z.string().max(100, 'Terme de recherche trop long').optional()
});

// Schémas pour les routes Express (avec params, body, query)
export const createReadListSchema = z.object({
  body: readListCreateSchema,
  params: z.object({}),
  query: z.object({})
});

export const updateReadListSchema = z.object({
  body: readListUpdateSchema,
  params: z.object({
    id: z.string().transform(val => parseInt(val))
  }),
  query: z.object({})
});

export const getReadListSchema = z.object({
  body: z.object({}),
  params: z.object({
    id: z.string().transform(val => parseInt(val))
  }),
  query: z.object({})
});

export const createReadListItemSchema = z.object({
  body: readListItemCreateSchema,
  params: z.object({}),
  query: z.object({})
});

export const updateReadListItemSchema = z.object({
  body: readListItemUpdateSchema,
  params: z.object({
    id: z.string().transform(val => parseInt(val))
  }),
  query: z.object({})
});

export const getReadListItemsSchema = z.object({
  body: z.object({}),
  params: z.object({
    readListId: z.string().transform(val => parseInt(val))
  }),
  query: readListItemQuerySchema
});

export const addResourceToReadListSchema = z.object({
  body: z.object({
    resourceId: z.number().int().positive('ID ressource invalide'),
    notes: z.string().max(1000).trim().optional(),
    order: z.number().int().min(0).optional()
  }),
  params: z.object({
    id: z.string().transform(val => parseInt(val))
  }),
  query: z.object({})
}); 