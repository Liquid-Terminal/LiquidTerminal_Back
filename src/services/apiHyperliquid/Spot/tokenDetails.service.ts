import { BaseApiService } from '../../base/base.api.service';
import { TokenDetailsResponse, AuctionInfo } from '../../../types/auction.types';

export class TokenDetailsApiService extends BaseApiService {
  constructor() {
    super('https://api-ui.hyperliquid.xyz/info');
  }

  // Méthode générique qui retourne toutes les données
  async getTokenDetailsRaw(tokenId: string): Promise<TokenDetailsResponse | null> {
    try {
      return await this.post<TokenDetailsResponse>('', {
        type: "tokenDetails",
        tokenId
      });
    } catch (error) {
      console.error(`Error fetching token ${tokenId}:`, error);
      return null;
    }
  }

  // Méthode spécifique pour les besoins de l'auction
  async getTokenAuctionDetails(tokenId: string): Promise<AuctionInfo | null> {
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