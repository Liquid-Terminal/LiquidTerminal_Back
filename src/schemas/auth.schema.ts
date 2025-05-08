import { z } from 'zod';

// Schéma pour la validation du token Privy
export const privyTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
}).strict();

// Schéma pour la validation des données de connexion
export const loginSchema = z.object({
  privyUserId: z.string().min(1, 'Privy User ID is required'),
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
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