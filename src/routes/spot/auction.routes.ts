import express, { Request, Response, RequestHandler } from 'express';
import { AuctionPageService } from '../../services/spot/auction/auction.service';
import { SpotDeployStateApiService } from '../../services/spot/auction/auctionTiming.service';
import { validateRequest, sanitizeInput } from '../../middleware/validation';
import { auctionQuerySchema, createAuctionSchema } from '../../schemas/spot.schemas';
import { AuctionError, InvalidAuctionDataError } from '../../errors/spot.errors';
import { logger } from '../../utils/logger';

const router = express.Router();
const spotDeployStateApi = new SpotDeployStateApiService();
const auctionService = new AuctionPageService(spotDeployStateApi);

// Appliquer la sanitization
router.use(sanitizeInput);

// Appliquer la validation des requêtes
router.get('/', validateRequest(auctionQuerySchema), (async (_req: Request, res: Response) => {
  try {
    const auctions = await auctionService.getAllAuctions();
    logger.info('Auctions retrieved successfully', { count: auctions.length });
    res.json(auctions);
  } catch (error) {
    logger.error('Error fetching auctions:', { error });
    
    if (error instanceof AuctionError) {
      return res.status(error.statusCode).json({
        error: error.code,
        message: error.message
      });
    }
    
    if (error instanceof InvalidAuctionDataError) {
      return res.status(error.statusCode).json({
        error: error.code,
        message: error.message
      });
    }
    
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

router.get('/timing', validateRequest(auctionQuerySchema), (async (_req: Request, res: Response) => {
  try {
    const timing = await auctionService.getAuctionTiming();
    logger.info('Auction timing retrieved successfully');
    res.json(timing);
  } catch (error) {
    logger.error('Error fetching auction timing:', { error });
    
    if (error instanceof AuctionError) {
      return res.status(error.statusCode).json({
        error: error.code,
        message: error.message
      });
    }
    
    if (error instanceof InvalidAuctionDataError) {
      return res.status(error.statusCode).json({
        error: error.code,
        message: error.message
      });
    }
    
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

export default router; 