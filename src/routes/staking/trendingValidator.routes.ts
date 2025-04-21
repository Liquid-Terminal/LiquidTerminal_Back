import { Router, Request, Response } from 'express';
import { TrendingValidatorService, SortBy } from '../../services/staking/trending.validator.service';
import { TrendingValidatorsResponse } from '../../types/staking.types';
import { marketRateLimiter } from '../../middleware/apiRateLimiter';
import { TrendingValidatorError } from '../../errors/staking.errors';
import { logDeduplicator } from '../../utils/logDeduplicator';

const router = Router();
const trendingService = TrendingValidatorService.getInstance();

// Appliquer le rate limiter à toutes les routes
router.use(marketRateLimiter);

/**
 * @route GET /staking/validators/trending
 * @description Récupère le top 5 des validateurs classés par nombre de tokens stake ou APR
 * @query sortBy - Critère de tri ('stake' ou 'apr', par défaut 'stake')
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const sortBy = (req.query.sortBy as SortBy) || 'stake';
    logDeduplicator.info('Fetching trending validators', { sortBy });

    const validators = await trendingService.getTrendingValidators(sortBy);
    const response: TrendingValidatorsResponse = {
      success: true,
      data: validators
    };

    logDeduplicator.info('Trending validators retrieved successfully', { 
      count: validators.length,
      sortBy
    });
    
    res.json(response);
  } catch (error) {
    logDeduplicator.error('Error in /trending route:', { error });
    
    if (error instanceof TrendingValidatorError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch trending validators',
        code: 'UNKNOWN_ERROR'
      });
    }
  }
});

export default router; 