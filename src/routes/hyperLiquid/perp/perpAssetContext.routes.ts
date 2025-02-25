import { Router, Request, Response, RequestHandler } from 'express';
import { PerpAssetContextService } from '../../../services/apiHyperliquid/perp/perpAssetContext.service';
import { marketRateLimiter } from '../../../middleware/rateLimiter';

const router = Router();
const perpAssetContextService = new PerpAssetContextService();

router.use(marketRateLimiter);

router.get('/', (async (_req: Request, res: Response) => {
  try {
    const response = await perpAssetContextService.getMetaAndAssetCtxsRaw();
    res.json(response);
  } catch (error) {
    console.error('Error fetching Hyperliquid data:', error);
    res.status(500).json({
      error: 'Failed to fetch Hyperliquid data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

export default router; 