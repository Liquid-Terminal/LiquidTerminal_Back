import { Router, Request, Response, RequestHandler } from 'express';
import { SpotGlobalStatsService } from '../../services/spot/spotStats.service';
import { marketRateLimiter } from '../../middleware/apiRateLimiter';
import { validateRequest } from '../../middleware/validation';
import { globalSpotStatsQuerySchema } from '../../schemas/spot.schemas';
import { logger } from '../../utils/logger';
import { logDeduplicator } from '../../utils/logDeduplicator';

const router = Router();
const spotGlobalStatsService = new SpotGlobalStatsService();

// Appliquer le rate limiting et la sanitization
router.use(marketRateLimiter);

// Appliquer la validation des requêtes
router.get('/', validateRequest(globalSpotStatsQuerySchema), (async (_req: Request, res: Response) => {
  try {
    const stats = await spotGlobalStatsService.getSpotGlobalStats();
    logDeduplicator.info('Spot global stats retrieved successfully', { 
      totalVolume24h: stats.totalVolume24h,
      totalMarketCap: stats.totalMarketCap,
      totalPairs: stats.totalPairs,
      totalSpotUSDC: stats.totalSpotUSDC,
      totalHIP2: stats.totalHIP2
    });
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching spot global stats:', { error });
    res.status(500).json({
      error: 'Failed to fetch spot global stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

export default router; 