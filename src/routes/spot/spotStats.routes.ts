import express, { Request, Response, RequestHandler } from 'express';
import { SpotGlobalStatsService } from '../../services/spot/spotStats.service';
import { validateGetRequest } from '../../middleware/validation';
import { globalSpotStatsGetSchema } from '../../schemas/spot.schemas';
import { logDeduplicator } from '../../utils/logDeduplicator';

const router = express.Router();
const spotGlobalStatsService = new SpotGlobalStatsService();

// Appliquer la validation des requêtes
router.get('/', validateGetRequest(globalSpotStatsGetSchema), (async (_req: Request, res: Response) => {
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
    logDeduplicator.error('Error fetching spot global stats:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      error: 'Failed to fetch spot global stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

export default router; 