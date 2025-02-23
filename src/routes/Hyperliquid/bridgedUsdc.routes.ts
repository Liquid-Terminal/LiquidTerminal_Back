import { Router, Request, Response, RequestHandler } from 'express';
import { BridgedUsdcService } from '../../services/apiHyperliquid/bridgedUsdc.service';
import { marketRateLimiter } from '../../middleware/rateLimiter';

const router = Router();
const bridgedUsdcService = new BridgedUsdcService();

router.use(marketRateLimiter);

router.get('/', (async (_req: Request, res: Response) => {
  try {
    const data = await bridgedUsdcService.getBridgedUsdcData();
    res.json(data);
  } catch (error) {
    console.error('Error fetching bridged USDC data:', error);
    res.status(500).json({
      error: 'Failed to fetch bridged USDC data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

export default router; 