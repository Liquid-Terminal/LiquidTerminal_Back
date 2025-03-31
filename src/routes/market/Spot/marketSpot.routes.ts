// src/routes/market.routes.ts
import { Router, Request, Response } from 'express';
import { SpotAssetContextService } from '../../../services/market/spot/spotAssetContext.service';
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

router.get('/trending', async (req: Request, res: Response) => {
  try {
    const marketsData = await marketService.getMarketsData();
    
    // Calculer les indices triés
    const sortIndices = {
      volume: marketsData
        .map((_, index) => index)
        .sort((a, b) => marketsData[b].volume - marketsData[a].volume),
      
      marketCap: marketsData
        .map((_, index) => index)
        .sort((a, b) => marketsData[b].marketCap - marketsData[a].marketCap),
      
      change24h: marketsData
        .map((_, index) => index)
        .sort((a, b) => marketsData[b].change24h - marketsData[a].change24h)
    };

    // Récupérer les paramètres de la requête
    const sortBy = (req.query.sortBy as keyof typeof sortIndices) || 'volume';
    const limit = Math.min(Number(req.query.limit) || 5, 100);

    // Obtenir les indices des tokens triés
    const trendingIndices = sortIndices[sortBy].slice(0, limit);

    // Utiliser les indices pour obtenir les tokens triés
    const trendingTokens = trendingIndices.map(index => marketsData[index]);

    // Ne renvoyer que les indices pertinents
    const relevantIndices = {
      volume: sortIndices.volume.slice(0, limit),
      marketCap: sortIndices.marketCap.slice(0, limit),
      change24h: sortIndices.change24h.slice(0, limit)
    };

    res.json({
      tokens: trendingTokens,
      sortIndices: relevantIndices,
      total: marketsData.length
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch trending spot tokens',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;