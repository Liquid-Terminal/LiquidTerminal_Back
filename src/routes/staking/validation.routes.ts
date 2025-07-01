import { Router, Request, Response } from 'express';
import { ValidationService } from '../../services/staking/validation.service';
import { ValidationResponse } from '../../types/staking.types';
import { marketRateLimiter } from '../../middleware/apiRateLimiter';
import { ValidatorError } from '../../errors/staking.errors';
import { logDeduplicator } from '../../utils/logDeduplicator';

const router = Router();
const validationService = ValidationService.getInstance();

// Appliquer le rate limiter à toutes les routes
router.use(marketRateLimiter);

/**
 * @route GET /staking/validations
 * @description Récupère toutes les actions de validation (delegate/undelegate)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    logDeduplicator.info('Fetching all validations');

    const validations = await validationService.getAllValidations();
    const response: ValidationResponse = {
      success: true,
      data: validations
    };

    logDeduplicator.info('All validations retrieved successfully', { 
      count: validations.length
    });
    
    res.json(response);
  } catch (error) {
    logDeduplicator.error('Error in /validations route:', { error });
    
    if (error instanceof ValidatorError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch validations',
        code: 'UNKNOWN_ERROR'
      });
    }
  }
});

export default router; 