import express, { Request, Response, RequestHandler } from 'express';
import { AuctionPageService } from '../../services/spot/auction/auction.service';
import { SpotAssetContextService } from '../../services/spot/marketData.service';
import { TokenInfoService } from '../../services/spot/tokenInfo.service';
import { SpotDeployStateApiService } from '../../services/spot/auction/auctionTiming.service';
import { HyperliquidSpotClient } from '../../clients/hyperliquid/spot/spot.assetcontext.client';
import { HyperliquidTokenInfoClient } from '../../clients/hyperliquid/spot/spot.tokeninfo.client';

const router = express.Router();
const spotAssetContextService = new SpotAssetContextService(HyperliquidSpotClient.getInstance());
const tokenInfoService = new TokenInfoService(HyperliquidTokenInfoClient.getInstance());
const spotDeployStateApi = new SpotDeployStateApiService();
const auctionService = new AuctionPageService(tokenInfoService, spotDeployStateApi, spotAssetContextService);

router.get('/', (async (_req: Request, res: Response) => {
  try {
    const auctions = await auctionService.getAllAuctions();
    res.json(auctions);
  } catch (error) {
    console.error('Error fetching auctions:', error);
    res.status(500).json({
      error: 'Failed to fetch auctions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

router.get('/timing', (async (_req: Request, res: Response) => {
  try {
    const timing = await auctionService.getAuctionTiming();
    res.json(timing);
  } catch (error) {
    console.error('Error fetching auction timing:', error);
    res.status(500).json({
      error: 'Failed to fetch auction timing',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

router.post('/update-cache', (async (_req: Request, res: Response) => {
  try {
    await auctionService.forceUpdate();
    res.json({ message: 'Cache update initiated successfully' });
  } catch (error) {
    console.error('Error updating cache:', error);
    res.status(500).json({
      error: 'Failed to update cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

router.get('/cache-status', (async (_req: Request, res: Response) => {
  try {
    const status = await auctionService.getCacheStatus();
    res.json(status);
  } catch (error) {
    console.error('Error fetching cache status:', error);
    res.status(500).json({
      error: 'Failed to fetch cache status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

export default router; 