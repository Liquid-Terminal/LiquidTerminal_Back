import { Router, Request, Response, RequestHandler } from 'express';
import { ValidatorSummariesService } from '../../../services/apiHyperliquid/Staking/validatorSummaries.service';
import { marketRateLimiter } from '../../../middleware/rateLimiter';

const router = Router();
const validatorSummariesService = new ValidatorSummariesService();

router.use(marketRateLimiter);

router.get('/', (async (_req: Request, res: Response) => {
  try {
    const data = await validatorSummariesService.getValidatorSummariesRaw();
    res.json(data);
  } catch (error) {
    console.error('Error fetching validator summaries:', error);
    res.status(500).json({
      error: 'Failed to fetch validator summaries',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

export default router; 