import { Router, Request, Response, RequestHandler } from 'express';
import { TokenInfoService } from '../../../services/apiHyperliquid/Spot/tokenInfo.service';
import { marketRateLimiter } from '../../../middleware/rateLimiter';

const router = Router();
const tokenInfoService = new TokenInfoService();

router.use(marketRateLimiter);

router.get('/:tokenId', (async (req: Request, res: Response) => {
  try {
    const { tokenId } = req.params;
    const details = await tokenInfoService.getTokenDetailsRaw(tokenId);
    
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