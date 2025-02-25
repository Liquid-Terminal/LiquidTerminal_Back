import { Router, Request, Response, RequestHandler } from 'express';
import { DashboardGlobalStatsService } from '../services/globalStats.service';
import { marketRateLimiter } from '../middleware/rateLimiter';

const router = Router();
const dashboardGlobalStatsService = new DashboardGlobalStatsService();

router.use(marketRateLimiter);

router.get('/', (async (_req: Request, res: Response) => {
  try {
    const stats = await dashboardGlobalStatsService.getDashboardGlobalStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard global stats:', error);
    res.status(500).json({
      error: 'Failed to fetch dashboard global stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

export default router;
