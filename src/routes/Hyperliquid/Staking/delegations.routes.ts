import { Router, Request, Response, RequestHandler } from 'express';
import { DelegationsService } from '../../../services/apiHyperliquid/Staking/delegations.service';
import { marketRateLimiter } from '../../../middleware/rateLimiter';

const router = Router();
const delegationsService = new DelegationsService();

router.use(marketRateLimiter);

router.get('/:address', (async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    
    if (!address) {
      return res.status(400).json({
        error: 'Address parameter is required'
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