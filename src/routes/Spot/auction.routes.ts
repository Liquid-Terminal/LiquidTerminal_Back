import express, { Request, Response, RequestHandler } from 'express';
import { AuctionPageService } from '../../services/spot/auction/auction.service';
import { SpotDeployStateApiService } from '../../services/spot/auction/auctionTiming.service';


const router = express.Router();

const spotDeployStateApi = new SpotDeployStateApiService();
const auctionService = new AuctionPageService(spotDeployStateApi);

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



export default router; 