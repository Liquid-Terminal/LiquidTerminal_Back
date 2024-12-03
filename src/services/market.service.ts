import fetch from 'node-fetch';
import type { SpotContext, AssetContext, MarketData, TokenDetails } from '../types/market.types';

export class MarketService {
  private readonly HYPERLIQUID_API = 'https://api.hyperliquid.xyz/info';
  private readonly HYPURRSCAN_API = 'https://api.hypurrscan.io/tokenDetails';

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
      return null;
    }
  }

  async getMarketsData(): Promise<MarketData[]> {
    try {
      const response = await fetch(this.HYPERLIQUID_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: "spotMetaAndAssetCtxs"
        })
      });

      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }

      const [spotData, assetContexts] = await response.json() as [SpotContext, AssetContext[]];
      
      const tokenNames = spotData.tokens.reduce((acc, token) => {
        acc[token.index] = token.name;
        return acc;
      }, {} as Record<number, string>);

      // Recover all the logos in parallel
      const marketsDataPromises = spotData.universe.map(async (market, index) => {
        const assetContext = assetContexts[index];
        const tokenIndex = market.tokens[0];
        const tokenName = tokenNames[tokenIndex];
        
        // Recover the logo
        const logo = await this.getTokenLogo(tokenName);
        
        const currentPrice = Number(assetContext.markPx);
        const prevDayPrice = Number(assetContext.prevDayPx);
        const circulatingSupply = Number(assetContext.circulatingSupply);
        
        const priceChange = ((currentPrice - prevDayPrice) / prevDayPrice) * 100;
        const volume = Number(assetContext.dayNtlVlm);
        const marketCap = currentPrice * circulatingSupply;

        return {
          name: tokenName,
          logo: logo,
          price: currentPrice,
          marketCap: marketCap,
          volume: volume,
          change24h: Number(priceChange.toFixed(2)),
          liquidity: Number(assetContext.midPx),
          supply: circulatingSupply
        };
      });

      // Wait until all logo requests have been completed
      const marketsData = await Promise.all(marketsDataPromises);

      // Sort marketsData by marketCap in descending order
      return marketsData.sort((a, b) => b.marketCap - a.marketCap);

    } catch (error) {
      throw error;
    }
  }
}
