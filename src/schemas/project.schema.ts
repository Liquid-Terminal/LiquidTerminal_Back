import { z } from 'zod';

// Base project schema
export const projectBaseSchema = z.object({
  title: z.string()
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title cannot exceed 100 characters'),
  desc: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(1000, 'Description cannot exceed 1000 characters'),
  logo: z.string().url('Logo must be a valid URL'),
  twitter: z.string().url('Twitter URL must be valid').optional(),
  discord: z.string().url('Discord URL must be valid').optional(),
  telegram: z.string().url('Telegram URL must be valid').optional(),
  website: z.string().url('Website URL must be valid').optional(),
  categoryId: z.number().int().nullable()
});

// Create project schema
export const createProjectSchema = z.object({
  body: projectBaseSchema,
  params: z.object({}),
  query: z.object({})
});

// Update project schema
export const updateProjectSchema = z.object({
  body: projectBaseSchema.partial(),
  params: z.object({
    id: z.string().transform(val => parseInt(val))
  }),
  query: z.object({})
});

// Project query schema
export const projectQuerySchema = z.object({
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().optional().default(10),
  sort: z.enum(['createdAt', 'title', 'updatedAt']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  search: z.string().max(100, 'Terme de recherche trop long').optional(),
  categoryId: z.number().int().optional()
});

// Base category schema
export const categoryBaseSchema = z.object({
  name: z.string()
    .min(3, 'Name must be at least 3 characters')
    .max(100, 'Name cannot exceed 100 characters'),
  description: z.string()
    .max(255, 'Description cannot exceed 255 characters')
    .optional()
});

// Create category schema
export const createCategorySchema = z.object({
  body: categoryBaseSchema,
  params: z.object({}),
  query: z.object({})
});

// Update category schema
export const updateCategorySchema = z.object({
  body: categoryBaseSchema.partial(),
  params: z.object({
    id: z.string().transform(val => parseInt(val))
  }),
  query: z.object({})
});

// Category query schema
export const categoryQuerySchema = z.object({
  params: z.object({}),
  body: z.object({}),
  query: z.object({
    search: z.string().optional(),
    page: z.string().transform(val => parseInt(val)).optional(),
    limit: z.string().transform(val => parseInt(val)).optional(),
    sort: z.enum(['name', 'createdAt', 'updatedAt']).optional(),
    order: z.enum(['asc', 'desc']).optional()
  })
});

// Schéma de validation pour les URLs
const urlSchema = z.string()
  .url('URL invalide')
  .max(255, 'URL trop longue')
  .regex(/^https:\/\//i, 'Seules les URLs HTTPS sont autorisées')
  .optional();

// Schéma de validation pour les images
const imageUrlSchema = z.string()
  .url('URL d\'image invalide')
  .max(255, 'URL d\'image trop longue')
  .regex(/^https:\/\//i, 'Seules les URLs HTTPS sont autorisées')
  .regex(/\.(jpg|jpeg|png|gif|webp)$/i, 'Format d\'image non supporté');

// Schéma de validation pour la création de projet
export const projectCreateSchema = z.object({
  title: z.string()
    .min(3, 'Le titre doit contenir au moins 3 caractères')
    .max(255, 'Le titre ne doit pas dépasser 255 caractères')
    .trim()
    .regex(/^[a-zA-Z0-9\s\-_.,!?]+$/, 'Le titre contient des caractères non autorisés'),
  
  desc: z.string()
    .min(10, 'La description doit contenir au moins 10 caractères')
    .max(1000, 'La description ne doit pas dépasser 1000 caractères')
    .trim(),
  
  logo: imageUrlSchema,
  
  twitter: urlSchema,
  discord: urlSchema,
  telegram: urlSchema,
  website: urlSchema,
  
  categoryId: z.number().optional()
});

// Schéma de validation pour la mise à jour de projet
export const projectUpdateSchema = projectCreateSchema.partial();

// Schéma de validation pour la mise à jour de catégorie
export const projectCategoryUpdateSchema = z.object({
  categoryId: z.number().nullable()
}); 