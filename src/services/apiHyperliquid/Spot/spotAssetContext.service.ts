import { BaseApiService } from '../../base/base.api.service';
import { Token, SpotContext, AssetContext, MarketData } from '../../../types/market.types';

export class SpotAssetContextService extends BaseApiService {
  private tokenIdsCache: Token[] | null = null;
  private lastUpdateTime: number = 0;
  private readonly CACHE_DURATION = 1000 * 60 * 15; // 15 minutes

  constructor() {
    super('https://api.hyperliquid.xyz/info');
  }

  // Retourne les données brutes de l'API
  public async getSpotMetaAndAssetCtxsRaw(): Promise<[SpotContext, AssetContext[]]> {
    return this.post('', {
      type: "spotMetaAndAssetCtxs"
    });
  }

  /**
   * Récupère tous les tokens avec leurs informations complètes
   */
  public async getTokens(): Promise<Token[]> {
    if (this.tokenIdsCache && (Date.now() - this.lastUpdateTime) < this.CACHE_DURATION) {
      return this.tokenIdsCache;
    }

    try {
      const [spotData] = await this.getSpotMetaAndAssetCtxsRaw();

      this.tokenIdsCache = spotData.tokens.filter(token => token.tokenId);
      this.lastUpdateTime = Date.now();

      return this.tokenIdsCache;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Récupère uniquement les IDs des tokens
   * Utilisé principalement par AuctionService
   */
  public async getTokenIds(): Promise<string[]> {
    const tokens = await this.getTokens();
    return tokens.map(token => token.tokenId).filter(Boolean);
  }

  /**
   * Récupère les données de marché
   */
  public async getMarketsData(): Promise<MarketData[]> {
    try {
      const [spotData, assetContexts] = await this.getSpotMetaAndAssetCtxsRaw();

      // Create a token map for fast lookups
      const tokenMap = spotData.tokens.reduce((acc, token) => {
        acc[token.index] = token;
        return acc;
      }, {} as Record<number, { name: string }>);

      // Map markets and align with assetContexts
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
            const priceChange = ((currentPrice - prevDayPrice) / prevDayPrice) * 100;
            const volume = Number(assetContext.dayNtlVlm);
            const marketCap = currentPrice * circulatingSupply;

            return {
              name: token.name,
              logo: null,
              price: currentPrice,
              marketCap: marketCap,
              volume: volume,
              change24h: Number(priceChange.toFixed(2)),
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

    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Récupère les tokens sans paires
   */
  public async getTokensWithoutPairs(): Promise<string[]> {
    try {
      const [spotData] = await this.getSpotMetaAndAssetCtxsRaw();
      
      return spotData.tokens
        .filter(token => !spotData.universe.some(market => 
          market.tokens[0] === token.index
        ))
        .map(token => token.name);

    } catch (error) {
      throw this.handleError(error);
    }
  }
}