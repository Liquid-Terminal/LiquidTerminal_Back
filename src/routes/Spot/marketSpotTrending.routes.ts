import { Router, Request, Response } from 'express';
import { SpotAssetContextService } from '../../services/spot/marketData.service';
import { HyperliquidSpotClient } from '../../clients/hyperliquid/spot/spot.assetcontext.client';
import { marketRateLimiter } from '../../middleware/apiRateLimiter';

const router = Router();
const marketService = new SpotAssetContextService(HyperliquidSpotClient.getInstance());

// Appliquer le rate limiting
router.use(marketRateLimiter);

router.get('/', async (req: Request, res: Response) => {
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