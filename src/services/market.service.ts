import fetch from 'node-fetch';
import type { SpotContext, AssetContext, MarketData } from '../types/market.types';

export class MarketService {
  private readonly API_URL = 'https://api.hyperliquid.xyz/info';

  async getMarketsData(): Promise<MarketData[]> {
    try {
      console.log('Fetching data from API...');
      const response = await fetch(this.API_URL, {
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
      
      console.log('Raw API response:', { spotData, assetContexts });

      // Transform and sort by marketCap in descending order
      const marketsData: MarketData[] = spotData.universe.map((market, index) => {
        const assetContext = assetContexts[index];
        
        // Converting strings to numbers
        const currentPrice = Number(assetContext.markPx);
        const prevDayPrice = Number(assetContext.prevDayPx);
        const circulatingSupply = Number(assetContext.circulatingSupply);
        
        // Calculs
        const priceChange = ((currentPrice - prevDayPrice) / prevDayPrice) * 100;
        const volume = Number(assetContext.dayNtlVlm);
        const marketCap = currentPrice * circulatingSupply; // Market cap calculation

        return {
          name: market.name.split('/')[0],
          price: currentPrice,
          marketCap: marketCap,
          volume: volume,
          change24h: Number(priceChange.toFixed(2)),
          liquidity: Number(assetContext.midPx),
          supply: circulatingSupply
        };
      });

      // Sort by marketCap in descending order
      const sortedMarketsData = marketsData.sort((a, b) => b.marketCap - a.marketCap);

      console.log('Sorted market data:', sortedMarketsData);
      return sortedMarketsData;

    } catch (error) {
      console.error('Error fetching market data:', error);
      throw error;
    }
  }
}
