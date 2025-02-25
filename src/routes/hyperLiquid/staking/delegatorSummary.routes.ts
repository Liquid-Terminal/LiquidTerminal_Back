import { Router, Request, Response, RequestHandler } from 'express';
import { DelegatorSummaryService } from '../../../services/apiHyperliquid/staking/delegatorSummary.service';
import { marketRateLimiter } from '../../../middleware/rateLimiter';

const router = Router();
const delegatorSummaryService = new DelegatorSummaryService();

router.use(marketRateLimiter);

router.get('/:address', (async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    
    if (!address) {
      return res.status(400).json({
        error: 'Address parameter is required'
      });
    }

    const data = await delegatorSummaryService.getDelegatorSummaryRaw(address);
    res.json(data);
  } catch (error) {
    console.error('Error fetching delegator summary:', error);
    res.status(500).json({
      error: 'Failed to fetch delegator summary',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

export default router; 