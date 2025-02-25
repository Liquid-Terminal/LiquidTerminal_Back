// src/routes/market.routes.ts
import { Router, Request, Response } from 'express';
import { SpotAssetContextService } from '../../../services/apiHyperliquid/Spot/spotAssetContext.service';
import { marketRateLimiter } from '../../../middleware/rateLimiter';

const router = Router();
const marketService = new SpotAssetContextService();

// Appliquer le rate limiting
router.use(marketRateLimiter);

router.get('/', async (req: Request, res: Response) => {
  try {
    const markets = await marketService.getMarketsData();
    res.json(markets);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Market route error:', error);
    
    if (errorMessage === 'API request timed out') {
      res.status(504).json({
        error: 'Gateway Timeout',
        message: 'The request to external API timed out'
      });
      return;
    }

    res.status(500).json({
      error: 'Failed to fetch market data',
      message: errorMessage
    });
  }
});

router.get('/tokens-without-pairs', async (req: Request, res: Response) => {
  try {
    const tokens = await marketService.getTokensWithoutPairs();
    res.json(tokens);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch tokens without pairs',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;