import { Router, Request, Response } from 'express';
import { ValidatorSummariesService, SortBy } from '../../services/staking/validator.service';
import { TrendingValidatorService } from '../../services/staking/trending.validator.service';
import { TrendingValidatorsResponse, ValidatorDetailsResponse } from '../../types/staking.types';
import { marketRateLimiter } from '../../middleware/apiRateLimiter';
import { logger } from '../../utils/logger';
import { ValidatorError, TrendingValidatorError } from '../../errors/staking.errors';

const router = Router();
const validatorService = ValidatorSummariesService.getInstance();
const trendingService = TrendingValidatorService.getInstance();

// Appliquer le rate limiter à toutes les routes
router.use(marketRateLimiter);

/**
 * @route GET /staking/validators/trending
 * @description Récupère le top 5 des validateurs classés par nombre de tokens stake ou APR
 * @query sortBy - Critère de tri ('stake' ou 'apr', par défaut 'stake')
 */
router.get('/trending', async (req: Request, res: Response) => {
  try {
    const sortBy = (req.query.sortBy as SortBy) || 'stake';
    logger.info('Fetching trending validators', { sortBy });

    const validators = await trendingService.getTrendingValidators(sortBy);
    const response: TrendingValidatorsResponse = {
      success: true,
      data: validators
    };

    logger.info('Trending validators retrieved successfully', { count: validators.length });
    res.json(response);
  } catch (error) {
    logger.error('Error in /trending route:', { error });
    
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

/**
 * @route GET /staking/validators
 * @description Récupère tous les validateurs avec leurs détails
 * @query sortBy - Critère de tri ('stake' ou 'apr', par défaut 'stake')
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const sortBy = (req.query.sortBy as SortBy) || 'stake';
    logger.info('Fetching all validators', { sortBy });

    const validators = await validatorService.getAllValidatorsDetails(sortBy);
    const response: ValidatorDetailsResponse = {
      success: true,
      data: validators
    };

    logger.info('All validators retrieved successfully', { count: validators.length });
    res.json(response);
  } catch (error) {
    logger.error('Error in /validators route:', { error });
    
    if (error instanceof ValidatorError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch validators',
        code: 'UNKNOWN_ERROR'
      });
    }
  }
});

export default router; 