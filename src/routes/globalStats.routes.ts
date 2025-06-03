import { Router, Request, Response, RequestHandler } from 'express';
import { DashboardGlobalStatsService } from '../services/globalStatsLiquid.service';
import { marketRateLimiter } from '../middleware/apiRateLimiter';
import { HyperliquidGlobalStatsClient } from '../clients/hyperliquid/globalstats.client';
import { logDeduplicator } from '../utils/logDeduplicator';

const router = Router();
const dashboardGlobalStatsService = new DashboardGlobalStatsService();
const globalStatsClient = HyperliquidGlobalStatsClient.getInstance();

router.use(marketRateLimiter);

router.get('/', (async (_req: Request, res: Response) => {
  try {
    const stats = await dashboardGlobalStatsService.getDashboardGlobalStats();
    res.json(stats);
  } catch (error) {
    logDeduplicator.error('Error fetching dashboard global stats', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({
      error: 'Failed to fetch dashboard global stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

router.get('/dashboard', async (req, res) => {
  try {
    const stats = await globalStatsClient.getGlobalStats();
    res.json(stats);
  } catch (error) {
    logDeduplicator.error('Error fetching dashboard global stats', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

export default router;
