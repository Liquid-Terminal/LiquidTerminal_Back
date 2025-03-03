import { Router, Request, Response, RequestHandler } from 'express';
import { DelegationsService } from '../../../services/apiHyperliquid/staking/delegations.service';
import { marketRateLimiter } from '../../../middleware/rateLimiter';

const router = Router();
const delegationsService = new DelegationsService();

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

    const data = await delegationsService.getDelegationsRaw(address);
    res.json(data);
  } catch (error) {
    console.error('Error fetching delegations data:', error);
    res.status(500).json({
      error: 'Failed to fetch delegations data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

export default router; 