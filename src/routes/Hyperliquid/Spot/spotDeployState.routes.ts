import { Router, Request, Response, RequestHandler } from 'express';
import { SpotDeployStateApiService } from '../../../services/apiHyperliquid/Spot/spotDeployState.service';
import { marketRateLimiter } from '../../../middleware/rateLimiter';

const router = Router();
const spotDeployStateService = new SpotDeployStateApiService();

router.use(marketRateLimiter);

router.get('/', (async (_req: Request, res: Response) => {
  try {
    const deployState = await spotDeployStateService.getSpotDeployState();
    
    if (!deployState) {
      return res.status(404).json({ message: 'Deploy state not found' });
    }

    res.json(deployState);
  } catch (error) {
    console.error('Error fetching deploy state:', error);
    res.status(500).json({
      error: 'Failed to fetch deploy state',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

export default router; 