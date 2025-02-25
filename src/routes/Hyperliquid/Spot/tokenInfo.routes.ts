import express, { Request, Response, RequestHandler } from "express";
import { TokenInfoService } from "../../../services/apiHyperliquid/Spot/tokenInfo.service";
import { marketRateLimiter } from "../../../middleware/rateLimiter";

const router = express.Router();
const tokenInfoService = new TokenInfoService();

router.use(marketRateLimiter);

router.get('/:tokenId', (async (req: Request, res: Response) => {
  try {
    const { tokenId } = req.params;
    const tokenInfo = await tokenInfoService.getTokenInfo(tokenId);
    
    if (!tokenInfo) {
      return res.status(404).json({
        error: 'Token info not found',
        message: `Could not fetch information for token ID ${tokenId}`
      });
    }
    
    res.json(tokenInfo);
  } catch (error) {
    console.error('Error fetching token info:', error);
    res.status(500).json({
      error: 'Failed to fetch token info',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

export default router; 