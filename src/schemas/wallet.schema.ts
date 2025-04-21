import { z } from 'zod';

export const walletCreateSchema = z.object({
  address: z.string()
    .min(42, 'Address must be 42 characters')
    .max(42, 'Address must be 42 characters')
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address format'),
  privyUserId: z.string().min(1, 'PrivyUserId is required')
});

export const walletUpdateSchema = z.object({
  address: z.string()
    .min(42, 'Address must be 42 characters')
    .max(42, 'Address must be 42 characters')
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address format')
    .optional()
});

export const walletQuerySchema = z.object({
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
  search: z.string().optional(),
  userId: z.number().int().positive().optional()
});

export const getWalletsByUserSchema = z.object({
  privyUserId: z.string().min(1, 'PrivyUserId est requis')
});

export type AddWalletInput = z.infer<typeof walletCreateSchema>;
export type GetWalletsByUserInput = z.infer<typeof getWalletsByUserSchema>; 