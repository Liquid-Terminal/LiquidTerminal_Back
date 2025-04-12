import { ValidatorSummary, TrendingValidator, ValidatorDetails, ValidatorStats } from '../../types/staking.types';
import { ValidatorClient } from '../../clients/hyperliquid/staking/validator';
import { redisService } from '../../core/redis.service';

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
        }
      } catch (error) {
        console.error('Error processing cache update:', error);
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
    return this.validatorClient.getValidatorSummariesRaw();
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
   * Récupère le top 5 des validateurs classés par nombre de tokens stake ou APR
   */
  public async getTrendingValidators(sortBy: SortBy = 'stake'): Promise<TrendingValidator[]> {
    try {
      const validators = await this.getValidatorSummaries();
      
      // Convertir les stakes (diviser par 10^8) et trier par ordre décroissant
      const formattedValidators = validators.map(validator => {
        const predictedApr = parseFloat(validator.stats[0][1].predictedApr) * 100;
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
      
      return allValidators;
    } catch (error) {
      console.error('Error fetching trending validators:', error);
      throw error;
    }
  }

  /**
   * Récupère tous les validateurs avec leurs détails formatés
   */
  public async getAllValidatorsDetails(sortBy: SortBy = 'stake'): Promise<ValidatorDetails[]> {
    try {
      const validators = await this.getValidatorSummaries();
      
      const formattedValidators = validators.map(validator => {
        const predictedApr = parseFloat(validator.stats[0][1].predictedApr) * 100;
        const uptime = parseFloat(validator.stats[0][1].uptimeFraction) * 100;
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
      return formattedValidators.sort((a, b) => {
        if (sortBy === 'stake') {
          return b.stake - a.stake;
        } else {
          return b.apr - a.apr;
        }
      });
    } catch (error) {
      console.error('Error fetching validator details:', error);
      throw error;
    }
  }
} 