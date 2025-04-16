import { WalletService } from './walletDB.service';
import { logger } from '../../utils/logger';
import { WalletError } from '../../errors/wallet.errors';
import { logDeduplicator } from '../../utils/logDeduplicator';

export class PortfolioService {
  private static instance: PortfolioService;
  private walletService: WalletService;
  
  private constructor() {
    this.walletService = WalletService.getInstance();
  }

  public static getInstance(): PortfolioService {
    if (!PortfolioService.instance) {
      PortfolioService.instance = new PortfolioService();
    }
    return PortfolioService.instance;
  }

  async getPortfolioData(userId: number) {
    try {
      const wallets = await this.walletService.getWalletsByUser(userId);
      
      logDeduplicator.info('Portfolio data retrieved successfully', { userId, walletCount: wallets.length });
      
      return {
        wallets: wallets,
      };
    } catch (error) {
      logger.error('Error retrieving portfolio data:', { error, userId });
      throw new WalletError('Failed to retrieve portfolio data');
    }
  }
}