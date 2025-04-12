import { MarketData } from '../../types/market.types';
import { HyperliquidSpotClient } from '../../clients/hyperliquid/spot/spot.assetcontext.client';
import { redisService } from '../../core/redis.service';

export class SpotAssetContextService {
  private readonly UPDATE_CHANNEL = 'spot:data:updated';
  private lastUpdate: number = 0;  // Timestamp de la dernière mise à jour des données

  constructor(private hyperliquidClient: HyperliquidSpotClient) {
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
   * Récupère les données de marché
   */
  public async getMarketsData(): Promise<MarketData[]> {
    const [spotData, assetContexts] = await this.hyperliquidClient.getSpotMetaAndAssetCtxsRaw();
    
    const tokenMap = spotData.tokens.reduce((acc, token) => {
      acc[token.index] = token;
      return acc;
    }, {} as Record<number, { name: string }>);

    const marketsData = await Promise.all(
      spotData.universe.map(async (market) => {
        try {
          const assetContext = assetContexts.find(ctx => ctx.coin === market.name);
          if (!assetContext) {
            console.warn(`No asset context found for market: ${market.name}`);
            return null;
          }

          const tokenIndex = market.tokens[0];
          const token = tokenMap[tokenIndex];
          if (!token) {
            console.warn(`No token found for index: ${tokenIndex}`);
            return null;
          }

          const currentPrice = Number(assetContext.markPx);
          const prevDayPrice = Number(assetContext.prevDayPx);
          const circulatingSupply = Number(assetContext.circulatingSupply);
          const volume = Number(assetContext.dayNtlVlm);
          const marketCap = currentPrice * circulatingSupply;

          return {
            name: token.name,
            logo: null,
            price: currentPrice,
            marketCap: marketCap,
            volume: volume,
            change24h: this.calculatePriceChange(currentPrice, prevDayPrice),
            liquidity: Number(assetContext.midPx),
            supply: circulatingSupply
          };
        } catch (error) {
          console.error(`Error processing market ${market.name}:`, error);
          return null;
        }
      })
    );

    return marketsData
      .filter(Boolean)
      .sort((a, b) => b!.marketCap - a!.marketCap) as MarketData[];
  }

  /**
   * Récupère les tokens sans paires
   */
  public async getTokensWithoutPairs(): Promise<string[]> {
    const [spotData] = await this.hyperliquidClient.getSpotMetaAndAssetCtxsRaw();
    
    return spotData.tokens
      .filter(token => !spotData.universe.some(market => 
        market.tokens[0] === token.index
      ))
      .map(token => token.name);
  }

  /**
   * Récupère uniquement les IDs des tokens
   * Utilisé principalement par AuctionService
   */
  public async getTokenIds(): Promise<string[]> {
    const [spotData] = await this.hyperliquidClient.getSpotMetaAndAssetCtxsRaw();
    return spotData.tokens
      .filter(token => token.tokenId)
      .map(token => token.tokenId);
  }

  /**
   * Récupère le poids de la requête pour le rate limiting
   */
  public getRequestWeight(): number {
    return HyperliquidSpotClient.getRequestWeight();
  }
}