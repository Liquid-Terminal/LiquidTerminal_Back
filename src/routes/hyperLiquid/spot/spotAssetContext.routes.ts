import { Router, Request, Response, RequestHandler } from 'express';
import { SpotAssetContextService } from '../../../services/apiHyperliquid/spot/spotAssetContext.service';
import { marketRateLimiter } from '../../../middleware/rateLimiter';

const router = Router();
const spotAssetContextService = new SpotAssetContextService();

router.use(marketRateLimiter);

router.get('/', (async (_req: Request, res: Response) => {
  try {
    const response = await spotAssetContextService.getSpotMetaAndAssetCtxsRaw();
    res.json(response);
  } catch (error) {
    console.error('Error fetching spot asset context:', error);
    res.status(500).json({
      error: 'Failed to fetch spot asset context',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

export default router; 