import { ValidatorSummary, ValidatorDetails } from '../../types/staking.types';
import { ValidatorClient } from '../../clients/hyperliquid/staking/validator';
import { redisService } from '../../core/redis.service';
import { logger } from '../../utils/logger';
import { ValidatorError } from '../../errors/staking.errors';

export type SortBy = 'stake' | 'apr';

export class ValidatorSummariesService {
  private static instance: ValidatorSummariesService;
  private validatorClient: ValidatorClient;
  private readonly UPDATE_CHANNEL = 'staking:validators:updated';
  private lastUpdate: number = 0;

  private constructor() {
    this.validatorClient = ValidatorClient.getInstance();
    this.setupSubscriptions();
  }

  private setupSubscriptions(): void {
    redisService.subscribe(this.UPDATE_CHANNEL, async (message) => {
      try {
        const { type, timestamp } = JSON.parse(message);
        if (type === 'DATA_UPDATED') {
          this.lastUpdate = timestamp;
          logger.info('Validator data updated', { timestamp });
        }
      } catch (error) {
        logger.error('Error processing cache update:', { error });
      }
    });
  }

  public static getInstance(): ValidatorSummariesService {
    if (!ValidatorSummariesService.instance) {
      ValidatorSummariesService.instance = new ValidatorSummariesService();
    }
    return ValidatorSummariesService.instance;
  }

  /**
   * Récupère les résumés des validateurs
   */
  public async getValidatorSummaries(): Promise<ValidatorSummary[]> {
    try {
      const summaries = await this.validatorClient.getValidatorSummariesRaw();
      logger.info('Validator summaries retrieved successfully', { count: summaries.length });
      return summaries;
    } catch (error) {
      logger.error('Failed to fetch validator summaries:', { error });
      throw new ValidatorError('Failed to fetch validator summaries');
    }
  }

  /**
   * Récupère le poids de la requête pour le rate limiting
   */
  public checkRateLimit(ip: string): boolean {
    return this.validatorClient.checkRateLimit(ip);
  }

  public static getRequestWeight(): number {
    return ValidatorClient.getRequestWeight();
  }

  /**
   * Récupère tous les validateurs avec leurs détails formatés
   */
  public async getAllValidatorsDetails(sortBy: SortBy = 'stake'): Promise<ValidatorDetails[]> {
    try {
      const validators = await this.getValidatorSummaries();
      
      const formattedValidators = validators.map(validator => {
        // Vérifier si stats existe et contient les données nécessaires
        const predictedApr = validator.stats && validator.stats.length > 0 && validator.stats[0][1] 
          ? parseFloat(validator.stats[0][1].predictedApr) * 100 
          : 0;
        
        const uptime = validator.stats && validator.stats.length > 0 && validator.stats[0][1] 
          ? parseFloat(validator.stats[0][1].uptimeFraction) * 100 
          : 0;
        
        const commission = parseFloat(validator.commission) * 100;
        
        return {
          name: validator.name,
          stake: Number(validator.stake) / 100000000,
          apr: predictedApr,
          commission: commission,
          uptime: uptime
        };
      });

      // Trier les validateurs selon le critère spécifié
      const sortedValidators = formattedValidators.sort((a, b) => {
        if (sortBy === 'stake') {
          return b.stake - a.stake;
        } else {
          return b.apr - a.apr;
        }
      });

      logger.info('Validator details retrieved and formatted successfully', { 
        count: sortedValidators.length,
        sortBy 
      });

      return sortedValidators;
    } catch (error) {
      logger.error('Error fetching validator details:', { error, sortBy });
      throw new ValidatorError('Failed to fetch and format validator details');
    }
  }
} 