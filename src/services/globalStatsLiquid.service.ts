import { DashboardGlobalStats } from '../types/globalStats.types';
import { GlobalStatsService } from './apiHyperliquid/globalStats.service';
import { BridgedUsdcService } from './apiHyperliquid/bridgedUsdc.service';
import { ValidatorSummariesService } from './apiHyperliquid/staking/validatorSummaries.service';
import { SpotAssetContextService } from './apiHyperliquid/spot/spotAssetContext.service';
import { SpotUSDCService } from './apiHyperliquid/spot/spotUSDC.service';

export interface SpotGlobalStats {
  totalVolume24h: number;
  totalPairs: number;
  totalMarketCap: number;
  totalSpotUSDC: number;
  totalHIP2: number;
}

export class DashboardGlobalStatsService {
  private globalStatsService: GlobalStatsService;
  private bridgedUsdcService: BridgedUsdcService;
  private validatorSummariesService: ValidatorSummariesService;
  private spotAssetContextService: SpotAssetContextService;
  private spotUSDCService: SpotUSDCService;
  private readonly HYPE_DECIMALS = 8;

  constructor() {
    this.globalStatsService = new GlobalStatsService();
    this.bridgedUsdcService = new BridgedUsdcService();
    this.validatorSummariesService = new ValidatorSummariesService();
    this.spotAssetContextService = new SpotAssetContextService();
    this.spotUSDCService = new SpotUSDCService();
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
        this.validatorSummariesService.getValidatorSummariesRaw()
      ]);

      // Calculer le total de HYPE staké
      const rawTotalHypeStake = validatorSummaries.reduce((total, validator) => total + validator.stake, 0);
      const totalHypeStake = this.formatHypeAmount(rawTotalHypeStake);

      // Prendre la dernière valeur de USDC bridgé
      const latestBridgedUsdc = bridgedUsdcData[bridgedUsdcData.length - 1]?.totalCirculating.peggedUSD || 0;

      return {
        numberOfUsers: globalStats.nUsers,
        dailyVolume: globalStats.dailyVolume,
        bridgedUsdc: latestBridgedUsdc,
        totalHypeStake: totalHypeStake
      };
    } catch (error) {
      console.error('Error fetching dashboard global stats:', error);
      throw error;
    }
  }

  /**
   * Récupère les statistiques globales du marché spot
   */
  public async getSpotGlobalStats(): Promise<SpotGlobalStats> {
    try {
      // Récupérer les données en parallèle
      const [marketsData, spotUSDCData] = await Promise.all([
        this.spotAssetContextService.getMarketsData(),
        this.spotUSDCService.getSpotUSDCData()
      ]);

      // Calculer le volume total sur 24h
      const totalVolume24h = marketsData.reduce((total, market) => total + market.volume, 0);
      
      // Calculer le nombre total de paires
      const totalPairs = marketsData.length;
      
      // Calculer la capitalisation totale du marché
      const totalMarketCap = marketsData.reduce((total, market) => total + market.marketCap, 0);
      
      // Récupérer les données USDC spot
      const totalSpotUSDC = spotUSDCData.totalSpotUSDC;
      const totalHIP2 = spotUSDCData["HIP-2"];

      return {
        totalVolume24h,
        totalPairs,
        totalMarketCap,
        totalSpotUSDC,
        totalHIP2
      };
    } catch (error) {
      console.error('Error fetching spot global stats:', error);
      throw error;
    }
  }
}
