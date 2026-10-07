import { z } from 'zod';
import { CANDLE_INTERVALS } from '../../clients/hypedexer/rest/candles/candles.client';

/** GET /indexer/candles?coin=BTC&interval=5s&startTime=…&endTime=… */
export const candlesQuerySchema = z.object({
  query: z.object({
    coin: z.string().min(1).max(64).regex(/^[A-Za-z0-9@:/_-]+$/, 'Invalid coin'),
    interval: z.enum(CANDLE_INTERVALS),
    startTime: z.coerce.number().int().positive(),
    endTime: z.coerce.number().int().positive().optional(),
  }),
  params: z.object({}),
});
