import express, { Request, Response, RequestHandler } from 'express';
import { AuctionPageService } from '../../services/spot/auction/auction.service';
import { SpotDeployStateApiService } from '../../services/spot/auction/auctionTiming.service';
import { validateRequest } from '../../middleware/validation';
import { auctionQuerySchema } from '../../schemas/spot.schemas';
import { AuctionError, InvalidAuctionDataError } from '../../errors/spot.errors';
import { logDeduplicator } from '../../utils/logDeduplicator';

const router = express.Router();
const spotDeployStateApi = SpotDeployStateApiService.getInstance();
const auctionService = AuctionPageService.getInstance(spotDeployStateApi);

// Appliquer le rate limiting et la sanitization

// Appliquer la validation des requêtes
router.get('/', validateRequest(auctionQuerySchema), (async (_req: Request, res: Response) => {
  try {
    const auctionsData = await auctionService.getAllAuctions();
    const totalCount = auctionsData.usdcAuctions.length + auctionsData.hypeAuctions.length;
    
    logDeduplicator.info('Auctions retrieved successfully', { 
      total: totalCount,
      usdcCount: auctionsData.usdcAuctions.length,
      hypeCount: auctionsData.hypeAuctions.length,
      splitTimestamp: auctionsData.splitTimestamp,
      totalUsdcSpent: auctionsData.totalUsdcSpent,
      totalHypeSpent: auctionsData.totalHypeSpent
    });
    
    res.json({
      success: true,
      data: auctionsData
    });
  } catch (error) {
    logDeduplicator.error('Error fetching auctions:', { error: error instanceof Error ? error.message : String(error) });
    
    if (error instanceof AuctionError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.code,
        message: error.message
      });
    }
    
    if (error instanceof InvalidAuctionDataError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.code,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

router.get('/timing', validateRequest(auctionQuerySchema), (async (_req: Request, res: Response) => {
  try {
    const timing = await spotDeployStateApi.getAuctionTiming();
    logDeduplicator.info('Auction timing retrieved successfully', { 
      currentStartTime: timing.currentAuction.startTime,
      currentEndTime: timing.currentAuction.endTime,
      nextStartTime: timing.nextAuction.startTime
    });
    res.json(timing);
  } catch (error) {
    logDeduplicator.error('Error fetching auction timing:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

export default router; 