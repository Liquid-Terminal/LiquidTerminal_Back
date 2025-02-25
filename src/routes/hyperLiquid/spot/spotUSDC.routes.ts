import { Router, Request, Response, RequestHandler } from 'express';
import { SpotUSDCService } from '../../../services/apiHyperliquid/spot/spotUSDC.service';
import { marketRateLimiter } from '../../../middleware/rateLimiter';

const router = Router();
const spotUSDCService = new SpotUSDCService();

router.use(marketRateLimiter);

router.get('/', (async (_req: Request, res: Response) => {
  try {
    const data = await spotUSDCService.getSpotUSDCData();
    res.json(data);
  } catch (error) {
    console.error('Error fetching spot USDC data:', error);
    res.status(500).json({
      error: 'Failed to fetch spot USDC data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

export default router; 