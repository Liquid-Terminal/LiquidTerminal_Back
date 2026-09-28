import { Router, Request, Response, RequestHandler } from 'express';
import { z } from 'zod';
import { marketRateLimiter } from '../../middleware/apiRateLimiter';
import { validateGetRequest } from '../../middleware/validation';
import {
  elysiumAnalyticsContractsSchema,
  elysiumAnalyticsDaysSchema,
  elysiumAnalyticsStatusSchema,
} from '../../schemas/elysium-analytics.schema';
import { ElysiumAnalyticsService } from '../../services/elysium/elysium-analytics.service';
import { logDeduplicator } from '../../utils/logDeduplicator';

const router = Router();
const service = ElysiumAnalyticsService.getInstance();

type QuerySchema = z.ZodObject<{ query: z.ZodTypeAny; params: z.ZodTypeAny }>;

/** Prisma / driver failures mean the historical DB is unavailable (503). */
function isDatabaseError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name.startsWith('PrismaClient') || error.name === 'DriverAdapterError';
}

/**
 * Registers a read-only analytics route. The handler re-parses the query to
 * get coerced values and defaults (validateGetRequest does not mutate
 * req.query). Logs carry a fixed message + fixed code only.
 */
function register<S extends QuerySchema>(
  path: string,
  schema: S,
  code: string,
  handler: (query: z.infer<S['shape']['query']>) => Promise<unknown>
): void {
  const querySchema = schema.shape.query;
  router.get(
    path,
    marketRateLimiter,
    validateGetRequest(schema),
    (async (req: Request, res: Response) => {
      try {
        const query = querySchema.parse(req.query) as z.infer<S['shape']['query']>;
        const data = await handler(query);
        res.json({ success: true, data });
      } catch (error) {
        const db = isDatabaseError(error);
        logDeduplicator.error('GET /elysium/analytics failure', {
          code,
          errorType: error instanceof Error ? error.name : typeof error,
        });
        res
          .status(db ? 503 : 502)
          .json({ success: false, error: db ? 'Analytics unavailable' : 'Analytics error', code });
      }
    }) as RequestHandler
  );
}

register('/status', elysiumAnalyticsStatusSchema, 'ELYSIUM_ANALYTICS_STATUS_ERROR', () => service.getStatus());

register('/deployments', elysiumAnalyticsDaysSchema, 'ELYSIUM_ANALYTICS_DEPLOYMENTS_ERROR', (q) =>
  service.getDeployments(q.days)
);

register('/contracts', elysiumAnalyticsContractsSchema, 'ELYSIUM_ANALYTICS_CONTRACTS_ERROR', (q) =>
  service.getContracts(q.window)
);

register('/users', elysiumAnalyticsDaysSchema, 'ELYSIUM_ANALYTICS_USERS_ERROR', (q) => service.getUsers(q.days));

register('/bridge', elysiumAnalyticsDaysSchema, 'ELYSIUM_ANALYTICS_BRIDGE_ERROR', (q) => service.getBridge(q.days));

register('/economics', elysiumAnalyticsDaysSchema, 'ELYSIUM_ANALYTICS_ECONOMICS_ERROR', (q) =>
  service.getEconomics(q.days)
);

export default router;
