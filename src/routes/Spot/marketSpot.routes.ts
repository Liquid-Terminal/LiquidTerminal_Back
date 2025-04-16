// src/routes/market.routes.ts
import express, { Request, Response, RequestHandler } from 'express';
import { SpotAssetContextService } from '../../services/spot/marketData.service';
import { marketRateLimiter } from '../../middleware/apiRateLimiter';

const router = express.Router();
const spotAssetContextService = new SpotAssetContextService();

// Appliquer le rate limiting
router.use(marketRateLimiter);

router.get('/', (async (_req: Request, res: Response) => {
  try {
    const markets = await spotAssetContextService.getMarketsData();
    res.json(markets);
  } catch (error) {
    console.error('Error fetching market data:', error);
    res.status(500).json({
      error: 'Failed to fetch market data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

router.get('/tokens-without-pairs', async (req: Request, res: Response) => {
  try {
    const tokens = await spotAssetContextService.getTokensWithoutPairs();
    res.json(tokens);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch tokens without pairs',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;