import { Router, Request, Response } from 'express';
import { ValidatorSummariesService, SortBy } from '../../services/staking/validator.service';
import { ValidatorDetailsResponse } from '../../types/staking.types';
import { marketRateLimiter } from '../../middleware/apiRateLimiter';
import { ValidatorError } from '../../errors/staking.errors';
import { logDeduplicator } from '../../utils/logDeduplicator';

const router = Router();
const validatorService = ValidatorSummariesService.getInstance();

// Appliquer le rate limiter à toutes les routes
router.use(marketRateLimiter);

/**
 * @route GET /staking/validators
 * @description Récupère tous les validateurs avec leurs détails
 * @query sortBy - Critère de tri ('stake' ou 'apr', par défaut 'stake')
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const sortBy = (req.query.sortBy as SortBy) || 'stake';
    logDeduplicator.info('Fetching all validators', { sortBy });

    const validators = await validatorService.getAllValidatorsDetails(sortBy);
    const response: ValidatorDetailsResponse = {
      success: true,
      data: validators
    };

    logDeduplicator.info('All validators retrieved successfully', { 
      count: validators.length,
      sortBy
    });
    
    res.json(response);
  } catch (error) {
    logDeduplicator.error('Error in /validators route:', { error });
    
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