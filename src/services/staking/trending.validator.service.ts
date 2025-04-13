import { ValidatorClient } from '../../clients/hyperliquid/staking/validator';
import { TrendingValidator } from '../../types/staking.types';
import { logger } from '../../utils/logger';
import { TrendingValidatorError } from '../../errors/staking.errors';

export type SortBy = 'stake' | 'apr';

export class TrendingValidatorService {
  private static instance: TrendingValidatorService;
  private readonly client: ValidatorClient;

  private constructor() {
    this.client = ValidatorClient.getInstance();
  }

  public static getInstance(): TrendingValidatorService {
    if (!TrendingValidatorService.instance) {
      TrendingValidatorService.instance = new TrendingValidatorService();
    }
    return TrendingValidatorService.instance;
  }

  /**
   * Récupère le top 5 des validateurs classés par nombre de tokens stake ou APR
   */
  public async getTrendingValidators(sortBy: SortBy = 'stake'): Promise<TrendingValidator[]> {
    try {
      const validators = await this.client.getValidatorSummariesRaw();
      
      // Convertir les stakes (diviser par 10^8) et trier par ordre décroissant
      const formattedValidators = validators.map(validator => {
        // Vérifier si stats existe et contient les données nécessaires
        const predictedApr = validator.stats && validator.stats.length > 0 && validator.stats[0][1] 
          ? parseFloat(validator.stats[0][1].predictedApr) * 100 
          : 0;
        
        return {
          name: validator.name,
          stake: Number(validator.stake) / 100000000,
          apr: predictedApr
        };
      });

      // Agréger les validateurs de Hyper Foundation
      const hyperFoundationValidators = formattedValidators.filter(v => v.name.startsWith('Hyper Foundation'));
      const otherValidators = formattedValidators.filter(v => !v.name.startsWith('Hyper Foundation'));

      // Créer l'entrée agrégée pour Hyper Foundation
      const hyperFoundationAggregate: TrendingValidator = {
        name: 'Hyper Foundation (All)',
        stake: hyperFoundationValidators.reduce((sum, v) => sum + v.stake, 0),
        apr: hyperFoundationValidators[0]?.apr || 0 // Tous les APR sont identiques
      };

      // Combiner et trier
      const allValidators = [
        hyperFoundationAggregate,
        ...otherValidators
      ].sort((a, b) => sortBy === 'stake' ? b.stake - a.stake : b.apr - a.apr)
        .slice(0, 5);
      
      logger.info('Trending validators retrieved successfully', { 
        count: allValidators.length,
        sortBy,
        hyperFoundationStake: hyperFoundationAggregate.stake
      });

      return allValidators;
    } catch (error) {
      logger.error('Error fetching trending validators:', { error, sortBy });
      throw new TrendingValidatorError('Failed to fetch trending validators');
    }
  }
} 