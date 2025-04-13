import { Router, Request, Response, RequestHandler } from 'express';
import { DashboardGlobalStatsService } from '../../services/globalStatsLiquid.service';
import { marketRateLimiter } from '../../middleware/apiRateLimiter';
import { validateRequest, sanitizeInput } from '../../middleware/validation';
import { globalSpotStatsQuerySchema } from '../../schemas/spot.schemas';

const router = Router();
const dashboardGlobalStatsService = new DashboardGlobalStatsService();

// Appliquer le rate limiting et la sanitization
router.use(marketRateLimiter);
router.use(sanitizeInput);

// Appliquer la validation des requêtes
router.get('/', validateRequest(globalSpotStatsQuerySchema), (async (_req: Request, res: Response) => {
  try {
    const stats = await dashboardGlobalStatsService.getSpotGlobalStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching spot global stats:', error);
    res.status(500).json({
      error: 'Failed to fetch spot global stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

export default router; 