import { BaseApiService } from '../base/base.api.service';
import { ValidatorSummaries } from '../../types/staking.types';

export class ValidatorSummariesService extends BaseApiService {
  constructor() {
    super('https://api-ui.hyperliquid.xyz/info');
  }

  /**
   * Récupère les résumés de tous les validateurs
   */
  public async getValidatorSummariesRaw(): Promise<ValidatorSummaries> {
    try {
      const response = await this.post('', {
        type: "validatorSummaries"
      }) as ValidatorSummaries;
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }
} 