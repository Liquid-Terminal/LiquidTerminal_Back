import { WalletService } from './walletDB.service';

export class PortfolioService {
  private walletService: WalletService;

  constructor() {
    this.walletService = new WalletService();
  }

  async getPortfolioData(userId: number) {
    try {
      // Récupérer uniquement les wallets stockés en DB
      const wallets = await this.walletService.getWalletsByUser(userId);
      
      return {
        wallets: wallets,
        // On ne calcule plus de totalBalance car on n'a plus les données de balance
      };
    } catch (error) {
      throw new Error(`Erreur lors de la récupération des données du portfolio: ${error}`);
    }
  }
}