import prisma from "../../lib/prisma";
import { SpotBalanceApiService } from './spotBalance.service';
import { PerpBalanceApiService } from './perpBalance.service';
import type { WalletState, PerpAccountState } from '../../types/wallet.types';

export class WalletService {
  private spotBalanceApiService: SpotBalanceApiService;
  private perpBalanceApiService: PerpBalanceApiService;

  constructor() {
    this.spotBalanceApiService = new SpotBalanceApiService();
    this.perpBalanceApiService = new PerpBalanceApiService();
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

  public async getWalletInfo(address: string): Promise<{
    spot: WalletState;
    perp: PerpAccountState;
  }> {
    const [spotState, perpState] = await Promise.all([
      this.spotBalanceApiService.getWalletState(address),
      this.perpBalanceApiService.getPerpAccountState(address)
    ]);

    return {
      spot: spotState,
      perp: perpState
    };
  }

  public async getAllWalletsInfo(userId: number): Promise<{
    spot: WalletState[];
    perp: PerpAccountState[];
  }> {
    const userWallets = await this.getWalletsByUser(userId);
    
    const [spotStates, perpStates] = await Promise.all([
      Promise.all(userWallets.map(wallet => this.spotBalanceApiService.getWalletState(wallet.address))),
      Promise.all(userWallets.map(wallet => this.perpBalanceApiService.getPerpAccountState(wallet.address)))
    ]);

    return {
      spot: spotStates,
      perp: perpStates
    };
  }
}