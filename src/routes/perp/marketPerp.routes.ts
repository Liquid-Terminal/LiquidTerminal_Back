import { Router, Request, Response, RequestHandler } from 'express';
import { PerpAssetContextService } from '../../services/perp/perpAssetContext.service';
import { HyperliquidPerpClient } from '../../clients/hyperliquid/perp/perp.assetcontext.client';
import { marketRateLimiter } from '../../middleware/apiRateLimiter';
import { validateRequest, sanitizeInput } from '../../middleware/validation';
import { marketPerpQuerySchema } from '../../schemas/perp.schemas';
import { logger } from '../../utils/logger';
import { PerpMarketDataError, PerpTimeoutError } from '../../errors/perp.errors';

const router = Router();
const perpMarketService = new PerpAssetContextService(HyperliquidPerpClient.getInstance());

// Appliquer le rate limiting et la sanitization
router.use(marketRateLimiter);
router.use(sanitizeInput);

router.get('/', validateRequest(marketPerpQuerySchema), (async (req: Request, res: Response) => {
  try {
    const markets = await perpMarketService.getPerpMarketsData();
    
    // Convertir l'openInterest en dollars
    const marketsWithDollarOI = markets.map(token => ({
      ...token,
      openInterest: token.openInterest * token.price
    }));

    logger.info('Perp market data retrieved and processed successfully', { 
      count: marketsWithDollarOI.length 
    });
    
    res.json(marketsWithDollarOI);
  } catch (error) {
    logger.error('Error in perp market route:', { error });
    
    if (error instanceof PerpTimeoutError) {
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
      error: 'PERP_MARKET_DATA_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

export default router; 