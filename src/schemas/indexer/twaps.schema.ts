import { z } from 'zod';

const optionalString = z.string().max(256).optional();
const optionalNum = z.coerce.number().optional();
/** Rows are billed upstream: bound every page. */
const optionalLimit = z.coerce.number().int().min(1).max(1000).optional();
const ethUser = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid user address');
const twapIdParam = z.string().min(1).max(256);

export const twapsListQuerySchema = z.object({
  query: z.object({
    user: optionalString,
    coin: optionalString,
    status: optionalString,
    hours: optionalNum,
    limit: optionalLimit,
    offset: z.coerce.number().int().min(0).optional(),
    order: z.enum(['ASC', 'DESC', 'asc', 'desc']).optional(),
  }),
  params: z.object({}),
});

export const twapsStatsQuerySchema = z.object({
  query: z.object({
    hours: optionalNum,
    coin: optionalString,
  }),
  params: z.object({}),
});

export const twapsUserQuerySchema = z.object({
  query: z.object({
    status: optionalString,
    coin: optionalString,
    hours: optionalNum,
    limit: optionalLimit,
    offset: z.coerce.number().int().min(0).optional(),
    order: z.enum(['ASC', 'DESC', 'asc', 'desc']).optional(),
  }),
  params: z.object({ user_address: ethUser }),
});

export const twapsByIdParamsSchema = z.object({
  query: z.object({}),
  params: z.object({ twap_id: twapIdParam }),
});

export const twapsFillsQuerySchema = z.object({
  query: z.object({
    limit: optionalLimit,
    offset: z.coerce.number().int().min(0).optional(),
    order: z.enum(['ASC', 'DESC', 'asc', 'desc']).optional(),
  }),
  params: z.object({ twap_id: twapIdParam }),
});
