import { Router, Request, Response, RequestHandler } from 'express';
import { PerpAssetContextService } from '../../services/perp/perpAssetContext.service';
import { marketRateLimiter } from '../../middleware/apiRateLimiter';
import { validateRequest } from '../../middleware/validation';
import { marketPerpQuerySchema } from '../../schemas/perp.schemas';
import { logDeduplicator } from '../../utils/logDeduplicator';
import { PerpMarketDataError, PerpTimeoutError } from '../../errors/perp.errors';

const router = Router();
const perpMarketService = new PerpAssetContextService();

// Appliquer le rate limiting et la sanitization
router.use(marketRateLimiter);

router.get('/', validateRequest(marketPerpQuerySchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      sortBy, 
      sortOrder, 
      limit, 
      page,
      token,
      pair 
    } = req.query;

    const result = await perpMarketService.getPerpMarketsData({
      sortBy: sortBy as 'volume' | 'openInterest' | 'change24h',
      sortOrder: sortOrder as 'asc' | 'desc',
      limit: limit ? Number(limit) : undefined,
      page: page ? Number(page) : undefined,
      token: token as string,
      pair: pair as string
    });

    // Convertir l'openInterest en dollars
    const marketsWithDollarOI = result.data.map(token => ({
      ...token,
      openInterest: token.openInterest * token.price
    }));

    logDeduplicator.info('Perp market data retrieved successfully', { 
      count: marketsWithDollarOI.length,
      page: result.pagination.page,
      totalPages: result.pagination.totalPages
    });

    res.status(200).json({
      success: true,
      message: 'Perp market data retrieved successfully',
      data: marketsWithDollarOI,
      pagination: result.pagination
    });
  } catch (error) {
    logDeduplicator.error('Error retrieving perp market data:', { error });
    
    if (error instanceof PerpMarketDataError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code
      });
      return;
    }
    
    if (error instanceof PerpTimeoutError) {
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