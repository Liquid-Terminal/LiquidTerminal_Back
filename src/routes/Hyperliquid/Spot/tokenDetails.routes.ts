import { Router, Request, Response, RequestHandler } from 'express';
import { TokenDetailsApiService } from '../../../services/apiHyperliquid/Spot/tokenDetails.service';
import { marketRateLimiter } from '../../../middleware/rateLimiter';

const router = Router();
const tokenDetailsService = new TokenDetailsApiService();

router.use(marketRateLimiter);

router.get('/:tokenId', (async (req: Request, res: Response) => {
  try {
    const { tokenId } = req.params;
    const details = await tokenDetailsService.getTokenDetailsRaw(tokenId);
    
    if (!details) {
      return res.status(404).json({ message: 'Token details not found' });
    }

    res.json(details);
  } catch (error) {
    console.error('Error fetching token details:', error);
    res.status(500).json({
      error: 'Failed to fetch token details',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

export default router; 