import prisma from "../lib/prisma";
import { SpotBalanceApiService } from './apiHyperliquid/spot/spotBalance.service';
import type { WalletState } from '../types/wallet.types';

export class WalletService {
  private spotBalanceApiService: SpotBalanceApiService;

  constructor() {
    this.spotBalanceApiService = new SpotBalanceApiService();
  }

  public async addWallet(privyUserId: string, address: string) {
    const user = await prisma.user.findUnique({
      where: { privyUserId },
    });

    if (!user) {
      throw new Error("Utilisateur non trouvé.");
    }

    const existingWallet = await prisma.wallet.findUnique({
      where: { address },
    });

    if (existingWallet) {
      throw new Error("Ce wallet est déjà enregistré.");
    }

    return await prisma.wallet.create({
      data: {
        address,
        userId: user.id,
      },
    });
  }

  public async getWalletsByUser(userId: number) {
    return await prisma.wallet.findMany({
      where: { userId },
      orderBy: {
        addedAt: 'desc'
      }
    });
  }

  public async getWalletInfo(address: string): Promise<WalletState> {
    return await this.spotBalanceApiService.getWalletState(address);
  }

  public async getAllWalletsInfo(userId: number): Promise<WalletState[]> {
    const userWallets = await this.getWalletsByUser(userId);
    
    return await Promise.all(
      userWallets.map(wallet => this.getWalletInfo(wallet.address))
    );
  }
}