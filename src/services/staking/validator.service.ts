import { ValidatorSummary, ValidatorDetails, ValidatorOverallStats } from '../../types/staking.types';
import { redisService } from '../../core/redis.service';
import { ValidatorError } from '../../errors/staking.errors';
import { logDeduplicator } from '../../utils/logDeduplicator';

export type SortBy = 'stake' | 'apr';

export class ValidatorSummariesService {
  private static instance: ValidatorSummariesService;
  private readonly CACHE_KEY = 'staking:validators:raw_data';
  private readonly UPDATE_CHANNEL = 'staking:validators:updated';
  private lastUpdate: number = 0;

  private constructor() {
    this.setupSubscriptions();
  }

  private setupSubscriptions(): void {
    redisService.subscribe(this.UPDATE_CHANNEL, async (message) => {
      try {
        const { type, timestamp } = JSON.parse(message);
        if (type === 'DATA_UPDATED') {
          this.lastUpdate = timestamp;
          logDeduplicator.info('Validator data updated', { timestamp });
        }
      } catch (error) {
        logDeduplicator.error('Error processing cache update:', { error: error instanceof Error ? error.message : String(error) });
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
   * Récupère les résumés des validateurs depuis le cache
   */
  public async getValidatorSummaries(): Promise<ValidatorSummary[]> {
    try {
      const cachedData = await redisService.get(this.CACHE_KEY);
      if (!cachedData) {
        throw new ValidatorError('No validator data available in cache');
      }

      const summaries = JSON.parse(cachedData) as ValidatorSummary[];
      logDeduplicator.info('Validator summaries retrieved from cache', { 
        count: summaries.length,
        lastUpdate: this.lastUpdate
      });
      return summaries;
    } catch (error) {
      logDeduplicator.error('Failed to fetch validator summaries from cache:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw new ValidatorError('Failed to fetch validator summaries from cache');
    }
  }

  /**
   * Calcule les statistiques globales des validateurs
   */
  private calculateOverallStats(validators: ValidatorSummary[]): ValidatorOverallStats {
    const totalValidators = validators.length;
    const activeValidators = validators.filter(v => v.isActive).length;
    
    // Calculer le total des HYPE stakés (convertir depuis wei, diviser par 10^8)
    const totalHypeStaked = validators.reduce((total, validator) => {
      return total + (Number(validator.stake) / 100000000); // Division par 10^8 pour convertir en HYPE
    }, 0);

    return {
      totalValidators,
      activeValidators,
      totalHypeStaked
    };
  }

  /**
   * Récupère tous les validateurs avec leurs détails formatés depuis le cache
   */
  public async getAllValidatorsDetails(sortBy: SortBy = 'stake'): Promise<{ validators: ValidatorDetails[], stats: ValidatorOverallStats }> {
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
          validator: validator.validator,
          description: validator.description,
          stake: Number(validator.stake) / 100000000,
          apr: predictedApr,
          commission: commission,
          uptime: uptime,
          isActive: validator.isActive,
          nRecentBlocks: validator.nRecentBlocks
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

      // Calculer les statistiques globales
      const stats = this.calculateOverallStats(validators);

      logDeduplicator.info('Validator details retrieved and formatted from cache', { 
        count: sortedValidators.length,
        sortBy,
        totalValidators: stats.totalValidators,
        activeValidators: stats.activeValidators,
        totalHypeStaked: stats.totalHypeStaked,
        lastUpdate: this.lastUpdate
      });

      return {
        validators: sortedValidators,
        stats
      };
    } catch (error) {
      logDeduplicator.error('Error fetching validator details from cache:', { 
        error: error instanceof Error ? error.message : String(error), 
        sortBy 
      });
      throw new ValidatorError('Failed to fetch and format validator details from cache');
    }
  }
} 