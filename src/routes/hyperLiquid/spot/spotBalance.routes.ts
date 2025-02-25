import { Router, Request, Response, RequestHandler } from 'express';
import { SpotBalanceApiService } from '../../../services/apiHyperliquid/spot/spotBalance.service';
import { marketRateLimiter } from '../../../middleware/rateLimiter';

const router = Router();
const spotBalanceService = new SpotBalanceApiService();

router.use(marketRateLimiter);

router.get('/:address', (async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const balanceState = await spotBalanceService.getSpotClearinghouseStateRaw(address);
    
    if (!balanceState) {
      return res.status(404).json({ message: 'Balance state not found' });
    }

    res.json(balanceState);
  } catch (error) {
    console.error('Error fetching balance state:', error);
    res.status(500).json({
      error: 'Failed to fetch balance state',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

export default router; 