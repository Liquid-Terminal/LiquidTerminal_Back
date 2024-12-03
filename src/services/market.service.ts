import fetch from 'node-fetch';
import type { SpotContext, AssetContext, MarketData, TokenDetails } from '../types/market.types';

export class MarketService {
  private readonly HYPERLIQUID_API = 'https://api.hyperliquid.xyz/info';
  private readonly HYPURRSCAN_API = 'https://api.hypurrscan.io/tokenDetails';
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

  // Fetch token logo
  async getTokenLogo(tokenName: string): Promise<string | null> {
    try {
      const url = `${this.HYPURRSCAN_API}/${tokenName}`;
      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }
      const data = await response.json() as TokenDetails;
      return data.img || null;
    } catch (error) {
      console.error(`Error fetching logo for token ${tokenName}:`, error);
      return null;
    }
  }

  async getMarketsData(): Promise<MarketData[]> {
    try {
      const response = await fetch(this.HYPERLIQUID_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: "spotMetaAndAssetCtxs" })
      });

      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }

      const [spotData, assetContexts] = await response.json() as [SpotContext, AssetContext[]];

      const tokenMap = spotData.tokens.reduce((acc, token) => {
        acc[token.index] = token;
        return acc;
      }, {} as Record<number, { name: string }>);

      const marketsDataPromises = spotData.universe.map(async (market) => {
        const assetContext = assetContexts.find(ctx => ctx.coin === market.name);
        if (!assetContext) return null;

        const tokenIndex = market.tokens[0];
        const token = tokenMap[tokenIndex];
        if (!token) return null;

        const logo = await this.getTokenLogo(token.name);
        const currentPrice = Number(assetContext.markPx);
        const prevDayPrice = Number(assetContext.prevDayPx);
        const circulatingSupply = Number(assetContext.circulatingSupply);
        const priceChange = ((currentPrice - prevDayPrice) / prevDayPrice) * 100;
        const volume = Number(assetContext.dayNtlVlm);
        const marketCap = currentPrice * circulatingSupply;

        return {
          name: token.name,
          logo: logo || null,
          price: currentPrice,
          marketCap: marketCap,
          volume: volume,
          change24h: Number(priceChange.toFixed(2)),
          liquidity: Number(assetContext.midPx),
          supply: circulatingSupply
        };
      });

      const marketsData = (await Promise.all(marketsDataPromises)).filter(Boolean) as MarketData[];
      return marketsData.sort((a, b) => b.marketCap - a.marketCap);
    } catch (error) {
      console.error('Error fetching market data:', error);
      throw error;
    }
  }

  // Nouvel endpoint pour la Strict List
  async getStrictMarketsData(): Promise<MarketData[]> {
    const marketsData = await this.getMarketsData();
    return marketsData.filter((market) => this.STRICT_TOKENS.includes(market.name));
  }
}
