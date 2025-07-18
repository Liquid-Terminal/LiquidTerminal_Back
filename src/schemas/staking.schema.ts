import { z } from 'zod';

export const stakedHoldersQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => val ? parseInt(val, 10) : 1)
    .refine((val) => val >= 1, {
      message: 'Page must be greater than 0'
    }),
  limit: z
    .string()
    .optional()
    .transform((val) => val ? parseInt(val, 10) : 100)
    .refine((val) => val >= 1 && val <= 1000, {
      message: 'Limit must be between 1 and 1000'
    })
});

export const holderAddressParamSchema = z.object({
  address: z
    .string()
    .min(1, 'Address is required')
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address format')
});

export const topHoldersQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => val ? parseInt(val, 10) : 10)
    .refine((val) => val >= 1 && val <= 100, {
      message: 'Limit must be between 1 and 100'
    })
});

export type StakedHoldersQueryInput = z.infer<typeof stakedHoldersQuerySchema>;
export type HolderAddressParamInput = z.infer<typeof holderAddressParamSchema>;
export type TopHoldersQueryInput = z.infer<typeof topHoldersQuerySchema>; 