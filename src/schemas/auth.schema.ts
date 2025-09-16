import { z } from 'zod';

// Schéma pour la validation du token Privy
export const privyTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
}).strict();

// Schéma pour la validation des données de connexion
export const loginSchema = z.object({
  privyUserId: z.string().min(1, 'Privy User ID is required'),
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  referrerName: z.string().optional(),
}).strict();

// Schéma pour la validation des paramètres de route
export const userParamsSchema = z.object({
  privyUserId: z.string().min(1, 'Privy User ID is required'),
}).strict();

// Schéma pour la réponse d'authentification
export const authResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  user: z.object({
    id: z.string(),
    privyUserId: z.string(),
    name: z.string(),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
  }).optional(),
  error: z.string().optional(),
}).strict();

// ========== ADMIN SCHEMAS ==========

// Schéma pour les requêtes de liste d'utilisateurs admin
export const adminUsersQuerySchema = z.object({
  page: z.string().transform(val => parseInt(val)).pipe(z.number().int().positive()).optional().default(1),
  limit: z.string().transform(val => parseInt(val)).pipe(z.number().int().positive().max(1000)).optional().default(10),
  search: z.string().optional(),
  verified: z.enum(['true', 'false']).optional(),
}).strict();

// Schéma pour la mise à jour d'un utilisateur par admin
export const adminUserUpdateSchema = z.object({
  name: z.string().min(1, 'Name must be non-empty').max(100, 'Name must be less than 100 characters').optional(),
  email: z.string().email('Invalid email format').nullable().optional(),
  role: z.enum(['USER', 'MODERATOR', 'ADMIN']).optional(),
  verified: z.boolean().optional(),
}).strict().refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update'
});

// Schéma pour les paramètres d'utilisateur admin
export const adminUserParamsSchema = z.object({
  userId: z.string().regex(/^\d+$/, 'User ID must be a number'),
}).strict();

// Types
export type AdminUsersQueryInput = z.infer<typeof adminUsersQuerySchema>;
export type AdminUserUpdateInput = z.infer<typeof adminUserUpdateSchema>;
export type AdminUserParamsInput = z.infer<typeof adminUserParamsSchema>; 