import { Router, Request, Response, RequestHandler } from 'express';
import { DelegatorHistoryService } from '../../../services/apiHyperliquid/staking/delegatorHistory.service';
import { marketRateLimiter } from '../../../middleware/rateLimiter';

const router = Router();
const delegatorHistoryService = new DelegatorHistoryService();

router.use(marketRateLimiter);

router.get('/:address', (async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    
    if (!address) {
      return res.status(400).json({
        error: 'Address parameter is required'
      });
    }

    const data = await delegatorHistoryService.getDelegatorHistoryRaw(address);
    res.json(data);
  } catch (error) {
    console.error('Error fetching delegator history:', error);
    res.status(500).json({
      error: 'Failed to fetch delegator history',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

export default router; 