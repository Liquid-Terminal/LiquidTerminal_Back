import { ValidationRawData, ValidationInfo } from '../../types/staking.types';
import { HypurrscanValidationClient } from '../../clients/hypurrscan/validation.client';
import { redisService } from '../../core/redis.service';
import { ValidatorError } from '../../errors/staking.errors';
import { logDeduplicator } from '../../utils/logDeduplicator';

export class ValidationService {
  private static instance: ValidationService;
  private readonly validationClient: HypurrscanValidationClient;
  private readonly UPDATE_CHANNEL = 'hypurrscan:validations:updated';
  private lastUpdate: number = 0;

  // HYPE utilise 8 décimales (10^8)
  private static readonly HYPE_DECIMALS = 8;
  private static readonly WEI_DIVISOR = Math.pow(10, ValidationService.HYPE_DECIMALS);

  private constructor() {
    this.validationClient = HypurrscanValidationClient.getInstance();
    this.setupSubscriptions();
  }

  private setupSubscriptions(): void {
    redisService.subscribe(this.UPDATE_CHANNEL, async (message) => {
      try {
        const { type, timestamp } = JSON.parse(message);
        if (type === 'DATA_UPDATED') {
          this.lastUpdate = timestamp;
          logDeduplicator.info('Validation data updated', { timestamp });
        }
      } catch (error) {
        logDeduplicator.error('Error processing validation cache update:', { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    });
  }

  public static getInstance(): ValidationService {
    if (!ValidationService.instance) {
      ValidationService.instance = new ValidationService();
    }
    return ValidationService.instance;
  }

  /**
   * Convertit les wei en HYPE (divise par 10^8)
   */
  private weiToHype(wei: number): number {
    return wei / ValidationService.WEI_DIVISOR;
  }

  /**
   * Convertit un timestamp en string ISO
   */
  private timestampToISOString(timestamp: number): string {
    return new Date(timestamp).toISOString();
  }

  /**
   * Formate les données brutes en données lisibles
   */
  private formatValidationData(rawData: ValidationRawData[]): ValidationInfo[] {
    return rawData
      .filter(item => item.action.type === 'tokenDelegate' && item.error === null)
      .map(item => ({
        time: this.timestampToISOString(item.time),
        user: item.user,
        type: item.action.isUndelegate ? 'Undelegate' : 'Delegate' as 'Undelegate' | 'Delegate',
        amount: this.weiToHype(item.action.wei),
        validator: item.action.validator,
        hash: item.hash
      }))
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()); // Trier par date décroissante
  }

  /**
   * Récupère toutes les validations formatées
   */
  public async getAllValidations(): Promise<ValidationInfo[]> {
    try {
      const rawValidations = await this.validationClient.getValidations();
      const formattedValidations = this.formatValidationData(rawValidations);

      logDeduplicator.info('Validations retrieved and formatted successfully', { 
        totalCount: rawValidations.length,
        formattedCount: formattedValidations.length,
        lastUpdate: this.lastUpdate
      });

      return formattedValidations;
    } catch (error) {
      logDeduplicator.error('Error fetching and formatting validations:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw new ValidatorError('Failed to fetch validation data');
    }
  }

  /**
   * Démarre le polling du client
   */
  public startPolling(): void {
    this.validationClient.startPolling();
  }

  /**
   * Arrête le polling du client
   */
  public stopPolling(): void {
    this.validationClient.stopPolling();
  }
} 