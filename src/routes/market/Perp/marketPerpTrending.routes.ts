import { Router, Request, Response } from 'express';
import { PerpAssetContextService } from '../../../services/perp/perpAssetContext.service';
import { HyperliquidPerpClient } from '../../../clients/hyperliquid/perp/perp.assetcontext.client';
import { marketRateLimiter } from '../../../middleware/apiRateLimiter';

const router = Router();
const perpMarketService = new PerpAssetContextService(HyperliquidPerpClient.getInstance());

// Appliquer le rate limiting
router.use(marketRateLimiter);

router.get('/', async (req: Request, res: Response) => {
  try {
    const marketsData = await perpMarketService.getPerpMarketsData();
    
    // Convertir d'abord l'openInterest en dollars
    const marketsDataWithDollarOI = marketsData.map(token => ({
      ...token,
      openInterest: token.openInterest * token.price
    }));
    
    // Calculer les indices triés avec les données en dollars
    const sortIndices = {
      volume: marketsDataWithDollarOI
        .map((_, index) => index)
        .sort((a, b) => marketsDataWithDollarOI[b].volume - marketsDataWithDollarOI[a].volume),
      
      openInterest: marketsDataWithDollarOI
        .map((_, index) => index)
        .sort((a, b) => marketsDataWithDollarOI[b].openInterest - marketsDataWithDollarOI[a].openInterest),
      
      change24h: marketsDataWithDollarOI
        .map((_, index) => index)
        .sort((a, b) => marketsDataWithDollarOI[b].change24h - marketsDataWithDollarOI[a].change24h)
    };

    // Récupérer les paramètres de la requête
    const sortBy = (req.query.sortBy as keyof typeof sortIndices) || 'openInterest';
    const limit = Math.min(Number(req.query.limit) || 5, 100);

    // Obtenir les indices des tokens triés
    const trendingIndices = sortIndices[sortBy].slice(0, limit);

    // Utiliser les indices pour obtenir les tokens triés
    const trendingTokens = trendingIndices.map(index => marketsDataWithDollarOI[index]);

    // Ne renvoyer que les indices pertinents
    const relevantIndices = {
      volume: sortIndices.volume.slice(0, limit),
      openInterest: sortIndices.openInterest.slice(0, limit),
      change24h: sortIndices.change24h.slice(0, limit)
    };

    res.json({
      tokens: trendingTokens,
      sortIndices: relevantIndices,
      total: marketsData.length
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch trending perp tokens',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 