// src/routes/market.routes.ts
import { Router, Request, Response } from 'express';
import { SpotAssetContextService } from '../../services/spot/marketData.service';
import { marketRateLimiter } from '../../middleware/apiRateLimiter';
import { validateRequest } from '../../middleware/validation';
import { marketSpotQuerySchema } from '../../schemas/spot.schemas';
import { MarketDataError, RateLimitError } from '../../errors/spot.errors';
import { logDeduplicator } from '../../utils/logDeduplicator';

const router = Router();
const marketService = new SpotAssetContextService();

// Appliquer le rate limiting et la sanitization
router.use(marketRateLimiter);

// Appliquer la validation des requêtes
router.get('/', validateRequest(marketSpotQuerySchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      sortBy, 
      sortOrder, 
      limit, 
      page,
      token,
      pair 
    } = req.query;

    const result = await marketService.getMarketsData({
      sortBy: sortBy as 'volume' | 'marketCap' | 'change24h',
      sortOrder: sortOrder as 'asc' | 'desc',
      limit: limit ? Number(limit) : undefined,
      page: page ? Number(page) : undefined,
      token: token as string,
      pair: pair as string
    });

    logDeduplicator.info('Market data retrieved successfully', { 
      count: result.data.length,
      page: result.pagination.page,
      totalPages: result.pagination.totalPages
    });

    res.status(200).json({
      success: true,
      message: 'Market data retrieved successfully',
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    logDeduplicator.error('Error retrieving market data:', { error: error instanceof Error ? error.message : String(error) });
    
    if (error instanceof MarketDataError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code
      });
      return;
    }
    
    if (error instanceof RateLimitError) {
      res.status(error.statusCode).json({
        error: error.code,
        message: error.message
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

router.get('/tokens-without-pairs', validateRequest(marketSpotQuerySchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const tokens = await marketService.getTokensWithoutPairs();
    logDeduplicator.info('Tokens without pairs retrieved successfully', { count: tokens.length });
    res.status(200).json({
      success: true,
      message: 'Tokens without pairs retrieved successfully',
      data: tokens
    });
  } catch (error) {
    logDeduplicator.error('Error retrieving tokens without pairs:', { error: error instanceof Error ? error.message : String(error) });
    
    if (error instanceof MarketDataError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code
      });
      return;
    }
    
    if (error instanceof RateLimitError) {
      res.status(error.statusCode).json({
        error: error.code,
        message: error.message
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

export default router;