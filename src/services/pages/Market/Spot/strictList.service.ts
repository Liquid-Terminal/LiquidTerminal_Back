import { SpotAssetContextService } from '../../../apiHyperliquid/Spot/spotAssetContext.service';
import type { MarketData } from '../../../../types/market.types';

export class StrictListService {
  private readonly STRICT_TOKENS = [
    "HYPE",
    "PURR",
    "HFUN",
    "JEFF",
    "PIP",
    "CATBAL",
    "SCHIZO",
    "RAGE",
    "ATEHUN",
    "OMNIX",
    "POINTS"
  ];

  private marketService: SpotAssetContextService;

  constructor() {
    this.marketService = new SpotAssetContextService(); // Initialise le service principal pour récupérer les données de marché
  }

  async getStrictMarketsData(): Promise<MarketData[]> {
    const marketsData = await this.marketService.getMarketsData();
    return marketsData.filter((market) => this.STRICT_TOKENS.includes(market.name));
  }
}
