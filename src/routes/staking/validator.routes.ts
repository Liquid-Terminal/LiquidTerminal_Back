import { Router, Request, Response } from 'express';
import { ValidatorSummariesService, SortBy } from '../../services/staking/validator.service';
import { TrendingValidatorsResponse, ValidatorDetailsResponse } from '../../types/staking.types';
import { marketRateLimiter } from '../../middleware/apiRateLimiter';

const router = Router();
const validatorService = ValidatorSummariesService.getInstance();

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
    const validators = await validatorService.getTrendingValidators(sortBy);
    const response: TrendingValidatorsResponse = {
      success: true,
      data: validators
    };
    res.json(response);
  } catch (error) {
    console.error('Error in /trending route:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trending validators'
    });
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
    const validators = await validatorService.getAllValidatorsDetails(sortBy);
    const response: ValidatorDetailsResponse = {
      success: true,
      data: validators
    };
    res.json(response);
  } catch (error) {
    console.error('Error in /validators route:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch validators'
    });
  }
});

export default router; 