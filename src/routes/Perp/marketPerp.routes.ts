import { Router, Request, Response } from 'express';
import { PerpAssetContextService } from '../../services/perp/perpAssetContext.service';
import { HyperliquidPerpClient } from '../../clients/hyperliquid/perp/perp.assetcontext.client';
import { marketRateLimiter } from '../../middleware/apiRateLimiter';

const router = Router();
const perpMarketService = new PerpAssetContextService(HyperliquidPerpClient.getInstance());

// Appliquer le rate limiting
router.use(marketRateLimiter);

router.get('/', async (req: Request, res: Response) => {
  try {
    const markets = await perpMarketService.getPerpMarketsData();
    
    // Convertir l'openInterest en dollars
    const marketsWithDollarOI = markets.map(token => ({
      ...token,
      openInterest: token.openInterest * token.price
    }));

    res.json(marketsWithDollarOI);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Perp market route error:', error);
    
    if (errorMessage === 'API request timed out') {
      res.status(504).json({
        error: 'Gateway Timeout',
        message: 'The request to external API timed out'
      });
      return;
    }

    res.status(500).json({
      error: 'Failed to fetch perp market data',
      message: errorMessage
    });
  }
});

export default router; 