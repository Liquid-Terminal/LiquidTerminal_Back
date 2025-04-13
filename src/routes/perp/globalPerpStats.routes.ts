import { Router, Request, Response, RequestHandler } from 'express';
import { DashboardGlobalStatsService } from '../../services/globalStatsLiquid.service';
import { marketRateLimiter } from '../../middleware/apiRateLimiter';
import { validateRequest, sanitizeInput } from '../../middleware/validation';
import { globalPerpStatsQuerySchema } from '../../schemas/perp.schemas';
import { logger } from '../../utils/logger';
import { PerpGlobalStatsError } from '../../errors/perp.errors';

const router = Router();
const dashboardGlobalStatsService = new DashboardGlobalStatsService();

// Appliquer le rate limiting et la sanitization
router.use(marketRateLimiter);
router.use(sanitizeInput);

router.get('/', validateRequest(globalPerpStatsQuerySchema), (async (_req: Request, res: Response) => {
  try {
    const stats = await dashboardGlobalStatsService.getPerpGlobalStats();
    logger.info('Perp global stats retrieved successfully');
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching perp global stats:', { error });
    
    if (error instanceof PerpGlobalStatsError) {
      return res.status(error.statusCode).json({
        error: error.code,
        message: error.message
      });
    }
    
    res.status(500).json({
      error: 'PERP_GLOBAL_STATS_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

export default router; 