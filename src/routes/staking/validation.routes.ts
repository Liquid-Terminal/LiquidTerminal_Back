import { Router, Request, Response } from 'express';
import { ValidationService } from '../../services/staking/validation.service';
import { ValidationResponse } from '../../types/staking.types';
import { marketRateLimiter } from '../../middleware/apiRateLimiter';
import { validateGetRequest } from '../../middleware/validation';
import { validationsGetSchema } from '../../schemas/staking.schema';
import { ValidatorError } from '../../errors/staking.errors';
import { logDeduplicator } from '../../utils/logDeduplicator';

const router = Router();
const validationService = ValidationService.getInstance();

// Appliquer le rate limiter à toutes les routes
router.use(marketRateLimiter);

/**
 * @route GET /staking/validations
 * @description Récupère toutes les actions de validation (delegate/undelegate)
 * @query page - Numéro de page (défaut: 1)
 * @query limit - Nombre d'éléments par page (défaut: 50, max: 200)
 */
router.get('/', validateGetRequest(validationsGetSchema), async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    
    logDeduplicator.info('Fetching validations with pagination', { page, limit });

    const result = await validationService.getAllValidations({ page, limit });
    const response: ValidationResponse = {
      success: true,
      data: result.data,
      pagination: result.pagination
    };

    logDeduplicator.info('Validations retrieved successfully', { 
      count: result.data.length,
      page: result.pagination.page,
      totalPages: result.pagination.totalPages,
      totalItems: result.pagination.total
    });
    
    res.json(response);
  } catch (error) {
    logDeduplicator.error('Error in /validations route:', { 
      error: error instanceof Error ? error.message : String(error)
    });
    
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