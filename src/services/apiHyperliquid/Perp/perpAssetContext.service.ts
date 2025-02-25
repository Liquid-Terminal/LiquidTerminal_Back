import { BaseApiService } from '../../base/base.api.service';
import { PerpMarket, PerpAssetContext, PerpMarketData } from '../../../types/market.types';

export class PerpAssetContextService extends BaseApiService {
  constructor() {
    super('https://api.hyperliquid.xyz/info');
  }

  /**
   * Récupère les données brutes de l'API
   */
  public async getMetaAndAssetCtxsRaw(): Promise<[{ universe: PerpMarket[] }, PerpAssetContext[]]> {
    return this.post('', {
      type: "metaAndAssetCtxs"
    });
  }

  /**
   * Calcule la variation en pourcentage entre deux prix
   */
  private calculatePriceChange(currentPrice: number, previousPrice: number): number {
    if (previousPrice === 0) return 0;
    return Number(((currentPrice - previousPrice) / previousPrice * 100).toFixed(2));
  }

  /**
   * Récupère les données des marchés perpétuels
   */
  public async getPerpMarketsData(): Promise<PerpMarketData[]> {
    try {
      const [meta, assetContexts] = await this.getMetaAndAssetCtxsRaw();

      return meta.universe.map((market, index) => {
        const assetContext = assetContexts[index];
        const currentPrice = Number(assetContext.markPx);
        const prevDayPrice = Number(assetContext.prevDayPx);

        return {
          name: market.name,
          price: currentPrice,
          change24h: this.calculatePriceChange(currentPrice, prevDayPrice),
          volume: Number(assetContext.dayNtlVlm),
          openInterest: Number(assetContext.openInterest),
          funding: Number(assetContext.funding),
          maxLeverage: market.maxLeverage,
          onlyIsolated: market.onlyIsolated || false
        };
      });
    } catch (error) {
      throw this.handleError(error);
    }
  }
} 