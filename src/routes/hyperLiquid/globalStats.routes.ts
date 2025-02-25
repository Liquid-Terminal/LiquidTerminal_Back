import { Router, Request, Response } from 'express';
import { GlobalStatsService } from '../../services/apiHyperliquid/globalStats.service';
import { marketRateLimiter } from '../../middleware/rateLimiter';

const router = Router();
const globalStatsService = new GlobalStatsService();

router.get('/', marketRateLimiter, async (_req: Request, res: Response) => {
  try {
    const stats = await globalStatsService.getGlobalStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching global stats:', error);
    res.status(500).json({
      error: 'Failed to fetch global stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 