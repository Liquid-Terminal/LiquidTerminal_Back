import { TokenInfoResponse, FormattedTokenInfo, TokenHolder } from '../../../types/tokenInfo.types';

export class TokenInfoService {
  private readonly HYPERLIQUID_API = 'https://api-ui.hyperliquid.xyz/info';

  private formatHolders(balances: [string, string][]): TokenHolder[] {
    return balances.map(([address, balance]) => ({
      address,
      balance
    }));
  }

  public async getTokenInfo(tokenId: string): Promise<FormattedTokenInfo> {
    try {
      const response = await fetch(this.HYPERLIQUID_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: "tokenDetails",
          tokenId: tokenId
        })
      });

      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }

      const data = await response.json() as TokenInfoResponse;
      
      // Formater les données pour inclure les holders de manière plus lisible
      const holders = this.formatHolders(data.genesis.userBalances);
      const nonCirculatingHolders = this.formatHolders(data.nonCirculatingUserBalances);

      return {
        ...data,
        holders,
        nonCirculatingHolders
      };
    } catch (error) {
      console.error('Error fetching token info:', error);
      throw error;
    }
  }
} 