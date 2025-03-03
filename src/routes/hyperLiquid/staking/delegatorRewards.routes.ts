import { Router, Request, Response, RequestHandler } from 'express';
import { DelegatorRewardsService } from '../../../services/apiHyperliquid/staking/delegatorRewards.service';
import { marketRateLimiter } from '../../../middleware/rateLimiter';

const router = Router();
const delegatorRewardsService = new DelegatorRewardsService();

router.use(marketRateLimiter);

router.get('/:address', (async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({
        error: 'Invalid address format',
        message: 'Address must be a 42-character hexadecimal string starting with 0x'
      });
    }

    const data = await delegatorRewardsService.getDelegatorRewardsRaw(address);
    res.json(data);
  } catch (error) {
    console.error('Error fetching delegator rewards:', error);
    res.status(500).json({
      error: 'Failed to fetch delegator rewards',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

export default router; 