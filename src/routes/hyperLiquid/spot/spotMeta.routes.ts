import { Router, Request, Response, RequestHandler } from 'express';
import { SpotMetaService } from '../../../services/apiHyperliquid/spot/spotMeta.service';
import { marketRateLimiter } from '../../../middleware/rateLimiter';

const router = Router();
const spotMetaService = new SpotMetaService();

router.use(marketRateLimiter);

router.get('/', (async (_req: Request, res: Response) => {
  try {
    const data = await spotMetaService.getSpotMetaRaw();
    res.json(data);
  } catch (error) {
    console.error('Error fetching spot meta data:', error);
    res.status(500).json({
      error: 'Failed to fetch spot meta data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

export default router; 