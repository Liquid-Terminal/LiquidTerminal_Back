import { PerpMarketData } from '../../types/market.types';
import { HyperliquidPerpClient } from '../../clients/hyperliquid/perp/perp.assetcontext.client';
import { redisService } from '../../core/redis.service';

export class PerpAssetContextService {
  private readonly UPDATE_CHANNEL = 'perp:data:updated';
  private lastUpdate: number = 0;  // Timestamp de la dernière mise à jour des données

  constructor(private hyperliquidClient: HyperliquidPerpClient) {
    this.setupSubscriptions();
  }

  private setupSubscriptions(): void {
    redisService.subscribe(this.UPDATE_CHANNEL, async (message) => {
      try {
        const { type, timestamp } = JSON.parse(message);
        if (type === 'DATA_UPDATED') {
          this.lastUpdate = timestamp;  // Mise à jour du timestamp
        }
      } catch (error) {
        console.error('Error processing cache update:', error);
      }
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
      const [meta, assetContexts] = await this.hyperliquidClient.getMetaAndAssetCtxsRaw();

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
      console.error('Error fetching perp markets data:', error);
      throw error;
    }
  }

  /**
   * Récupère le poids de la requête pour le rate limiting
   */
  public getRequestWeight(): number {
    return HyperliquidPerpClient.getRequestWeight();
  }
} 