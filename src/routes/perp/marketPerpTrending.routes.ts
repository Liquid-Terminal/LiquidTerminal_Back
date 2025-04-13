import { Router, Request, Response, RequestHandler } from 'express';
import { PerpAssetContextService } from '../../services/perp/perpAssetContext.service';
import { HyperliquidPerpClient } from '../../clients/hyperliquid/perp/perp.assetcontext.client';
import { marketRateLimiter } from '../../middleware/apiRateLimiter';
import { validateRequest, sanitizeInput } from '../../middleware/validation';
import { marketPerpTrendingQuerySchema } from '../../schemas/perp.schemas';
import { logger } from '../../utils/logger';
import { PerpTrendingError, PerpMarketDataError } from '../../errors/perp.errors';

const router = Router();
const perpMarketService = new PerpAssetContextService(HyperliquidPerpClient.getInstance());

// Appliquer le rate limiting et la sanitization
router.use(marketRateLimiter);
router.use(sanitizeInput);

router.get('/', validateRequest(marketPerpTrendingQuerySchema), (async (req: Request, res: Response) => {
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

    // Récupérer les paramètres de la requête (déjà validés par le middleware)
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

    logger.info('Perp trending tokens retrieved successfully', { 
      sortBy, 
      limit, 
      totalTokens: marketsData.length 
    });

    res.json({
      tokens: trendingTokens,
      sortIndices: relevantIndices,
      total: marketsData.length
    });
  } catch (error) {
    logger.error('Error fetching trending perp tokens:', { error });
    
    if (error instanceof PerpTrendingError) {
      return res.status(error.statusCode).json({
        error: error.code,
        message: error.message
      });
    }
    
    if (error instanceof PerpMarketDataError) {
      return res.status(error.statusCode).json({
        error: error.code,
        message: error.message
      });
    }
    
    res.status(500).json({
      error: 'PERP_TRENDING_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

export default router; 