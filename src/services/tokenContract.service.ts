import { Token, SpotContext } from '../types/market.types';

export class TokenIDListService {
  private readonly HYPERLIQUID_API = 'https://api.hyperliquid.xyz/info';
  private tokenIdsCache: Token[] | null = null;
  private lastUpdateTime: number = 0;
  private readonly CACHE_DURATION = 1000 * 60 * 15; // 15 minutes

  public async getTokens(): Promise<Token[]> {
    // Retourner le cache s'il est valide
    if (this.tokenIdsCache && (Date.now() - this.lastUpdateTime) < this.CACHE_DURATION) {
      return this.tokenIdsCache;
    }

    // Sinon, récupérer les nouveaux tokens
    const response = await fetch(this.HYPERLIQUID_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: "spotMetaAndAssetCtxs" })
    });

    if (!response.ok) {
      throw new Error('Failed to fetch token list');
    }

    const [spotData] = await response.json() as [SpotContext];
    this.tokenIdsCache = spotData.tokens.filter(token => token.tokenId);
    this.lastUpdateTime = Date.now();

    return this.tokenIdsCache;
  }

  public async getTokenIds(): Promise<string[]> {
    const tokens = await this.getTokens();
    return tokens.map(token => token.tokenId).filter(Boolean);
  }
} 