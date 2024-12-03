import fetch from 'node-fetch';
import type { SpotContext, AssetContext, MarketData, TokenDetails } from '../types/market.types';

export class MarketService {
  private readonly HYPERLIQUID_API = 'https://api.hyperliquid.xyz/info';
  private readonly HYPURRSCAN_API = 'https://api.hypurrscan.io/tokenDetails';

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
      // Fetch market data from Hyperliquid API
      const response = await fetch(this.HYPERLIQUID_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: "spotMetaAndAssetCtxs" })
      });

      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }

      const [spotData, assetContexts] = await response.json() as [SpotContext, AssetContext[]];

      // Create a token map for fast lookups
      const tokenMap = spotData.tokens.reduce((acc, token) => {
        acc[token.index] = token; // Map token.index to token details
        return acc;
      }, {} as Record<number, { name: string }>);

      // Map markets and align with assetContexts
      const marketsDataPromises = spotData.universe.map(async (market) => {
        const assetContext = assetContexts.find(ctx => ctx.coin === market.name); // Match by coin name
        if (!assetContext) {
          console.warn(`No asset context found for market: ${market.name}`);
          return null;
        }

        const tokenIndex = market.tokens[0];
        const token = tokenMap[tokenIndex]; // Get token details using index
        if (!token) {
          console.warn(`No token found for index: ${tokenIndex}`);
          return null;
        }

        // Optional: Fetch logo (does not block processing)
        const logo = await this.getTokenLogo(token.name);

        // Parse and calculate market data
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

      // Resolve all promises and filter null values
      const marketsData = (await Promise.all(marketsDataPromises)).filter(Boolean) as MarketData[];

      // Sort by marketCap in descending order
      return marketsData.sort((a, b) => b.marketCap - a.marketCap);

    } catch (error) {
      console.error('Error fetching market data:', error);
      throw error;
    }
  }
}
