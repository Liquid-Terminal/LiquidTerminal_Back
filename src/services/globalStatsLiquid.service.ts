import { DashboardGlobalStats } from '../types/market.types';
import { ValidatorSummary } from '../types/staking.types';
import { GlobalStatsService } from './globalStats.service';
import { BridgedUsdcService } from './bridgedUsdc.service';
import { ValidatorSummariesService } from './staking/validator.service';
import { logger } from '../utils/logger';

export class DashboardGlobalStatsService {
  private globalStatsService: GlobalStatsService;
  private bridgedUsdcService: BridgedUsdcService;
  private validatorSummariesService: ValidatorSummariesService;
  private readonly HYPE_DECIMALS = 8;

  constructor() {
    this.globalStatsService = new GlobalStatsService();
    this.bridgedUsdcService = new BridgedUsdcService();
    this.validatorSummariesService = ValidatorSummariesService.getInstance();
  }

  private formatHypeAmount(rawAmount: number): number {
    return Math.floor(rawAmount / Math.pow(10, this.HYPE_DECIMALS));
  }

  /**
   * Récupère les statistiques globales personnalisées pour la dashboard
   */
  public async getDashboardGlobalStats(): Promise<DashboardGlobalStats> {
    try {
      // Récupérer les données en parallèle
      const [globalStats, bridgedUsdcData, validatorSummaries] = await Promise.all([
        this.globalStatsService.getGlobalStats(),
        this.bridgedUsdcService.getBridgedUsdcData(),
        this.validatorSummariesService.getValidatorSummaries()
      ]);

      // Calculer le total de HYPE staké
      const rawTotalHypeStake = validatorSummaries.reduce((total: number, validator: ValidatorSummary) => total + validator.stake, 0);
      const totalHypeStake = this.formatHypeAmount(rawTotalHypeStake);

      // Prendre la dernière valeur de USDC bridgé
      const latestBridgedUsdc = bridgedUsdcData[bridgedUsdcData.length - 1]?.totalCirculating.peggedUSD || 0;

      return {
        numberOfUsers: globalStats?.nUsers || 0,
        dailyVolume: globalStats?.dailyVolume || 0,
        bridgedUsdc: latestBridgedUsdc,
        totalHypeStake: totalHypeStake
      };
    } catch (error) {
      logger.error('Error fetching dashboard global stats:', { error });
      throw error;
    }
  }
}
