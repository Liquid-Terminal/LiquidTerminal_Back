import express, { Request, Response, RequestHandler } from "express";
import { TokenInfoService } from "../services/tokenInfo.service";

const router = express.Router();
const tokenInfoService = new TokenInfoService();

router.get('/:tokenId', (async (req: Request, res: Response) => {
  try {
    const { tokenId } = req.params;
    const tokenInfo = await tokenInfoService.getTokenInfo(tokenId);
    res.json(tokenInfo);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch token info',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

export default router; 