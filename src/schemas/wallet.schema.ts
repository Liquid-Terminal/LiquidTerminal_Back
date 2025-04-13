import { z } from 'zod';

export const addWalletSchema = z.object({
  privyUserId: z.string().min(1, 'PrivyUserId est requis'),
  address: z.string()
    .min(42, 'L\'adresse doit faire 42 caractères')
    .max(42, 'L\'adresse doit faire 42 caractères')
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Format d\'adresse invalide')
});

export const getWalletsByUserSchema = z.object({
  privyUserId: z.string().min(1, 'PrivyUserId est requis')
});

export type AddWalletInput = z.infer<typeof addWalletSchema>;
export type GetWalletsByUserInput = z.infer<typeof getWalletsByUserSchema>; 