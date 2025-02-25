import { BaseApiService } from '../../base/base.api.service';
import { 
  TokenInfoResponse, 
  FormattedTokenInfo, 
  TokenHolder 
} from '../../../types/tokenInfo.types';
import { AuctionInfo } from '../../../types/auction.types';

export class TokenInfoService extends BaseApiService {
  // Augmenter le timeout et le nombre de retries pour les requêtes à Hyperliquid
  private readonly CUSTOM_TIMEOUT = 10000; // 10 secondes
  private readonly CUSTOM_MAX_RETRIES = 5;
  private readonly CUSTOM_RETRY_DELAY = 2000; // 2 secondes

  constructor() {
    super('https://api.hyperliquid.xyz/info');
  }

  private formatHolders(balances: [string, string][]): TokenHolder[] {
    return balances.map(([address, balance]) => ({
      address,
      balance
    }));
  }

  // Méthode générique qui retourne toutes les données brutes
  public async getTokenDetailsRaw(tokenId: string): Promise<TokenInfoResponse | null> {
    try {
      // Utiliser des paramètres personnalisés pour cette requête spécifique
      return await this.withRetry(
        async () => {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.CUSTOM_TIMEOUT);
            
            const response = await fetch(`${this.baseUrl}`, {
              method: 'POST',
              headers: this.defaultHeaders,
              body: JSON.stringify({
                type: "tokenDetails",
                tokenId
              }),
              signal: controller.signal
            });
            
            clearTimeout(timeout);
            
            if (!response.ok) {
              const statusText = await response.text();
              throw new Error(`API responded with status: ${response.status} - ${statusText || 'No response body'}`);
            }
            
            return await response.json() as TokenInfoResponse;
          } catch (error) {
            if (error instanceof Error) {
              if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${this.CUSTOM_TIMEOUT}ms for token ${tokenId}`);
              }
              throw error;
            }
            throw new Error(`Unknown error for token ${tokenId}`);
          }
        },
        this.CUSTOM_MAX_RETRIES,
        this.CUSTOM_RETRY_DELAY
      );
    } catch (error) {
      console.error(`Error fetching token ${tokenId} after ${this.CUSTOM_MAX_RETRIES} retries:`, error);
      return null;
    }
  }

  // Méthode qui retourne les données formatées avec les holders
  public async getTokenInfo(tokenId: string): Promise<FormattedTokenInfo | null> {
    try {
      const data = await this.getTokenDetailsRaw(tokenId);
      
      if (!data) return null;
      
      // Formater les données pour inclure les holders de manière plus lisible
      const holders = this.formatHolders(data.genesis.userBalances);
      const nonCirculatingHolders = this.formatHolders(data.nonCirculatingUserBalances);

      return {
        ...data,
        holders,
        nonCirculatingHolders
      };
    } catch (error) {
      console.error('Error formatting token info:', error);
      return null;
    }
  }

  // Méthode spécifique pour les besoins de l'auction
  public async getTokenAuctionDetails(tokenId: string): Promise<AuctionInfo | null> {
    const details = await this.getTokenDetailsRaw(tokenId);
    if (!details) return null;

    return {
      time: new Date(details.deployTime).getTime(),
      deployer: details.deployer,
      name: details.name,
      deployGas: details.deployGas
    };
  }
} 