import { z } from 'zod';

// Schéma pour la création de Wallet
export const walletCreateSchema = z.object({
  address: z.string()
    .min(42, 'Address must be 42 characters')
    .max(42, 'Address must be 42 characters')
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address format'),
  name: z.string().optional()
});

// Schéma pour la mise à jour de Wallet
export const walletUpdateSchema = z.object({
  name: z.string().optional()
});

// Schéma pour les requêtes de Wallets
export const walletQuerySchema = z.object({
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
  search: z.string().optional(),
  userId: z.number().int().positive().optional()
});

// Types
export type WalletCreateInput = z.infer<typeof walletCreateSchema>;
export type WalletUpdateInput = z.infer<typeof walletUpdateSchema>; 