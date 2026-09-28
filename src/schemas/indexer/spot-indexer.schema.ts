import { z } from 'zod';

const optionalString = z.string().max(256).optional();
const optionalNum = z.coerce.number().optional();
/** Rows are billed upstream: bound every page. */
const optionalLimit = z.coerce.number().int().min(1).max(1000).optional();

export const spotAuctionsHistQuerySchema = z.object({
  query: z.object({
    lookback_hours: optionalNum,
    limit: optionalLimit,
    offset: z.coerce.number().int().min(0).optional(),
  }),
  params: z.object({}),
});

export const spotAuctionsLiveQuerySchema = z.object({
  query: z.object({
    freshness_sec: optionalNum,
  }),
  params: z.object({}),
});

export const spotPairsQuerySchema = z.object({
  query: z.object({
    limit: optionalLimit,
    offset: z.coerce.number().int().min(0).optional(),
  }),
  params: z.object({}),
});

export const spotTokensQuerySchema = z.object({
  query: z.object({
    search: optionalString,
    limit: optionalLimit,
    offset: z.coerce.number().int().min(0).optional(),
  }),
  params: z.object({}),
});
