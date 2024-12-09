import prisma from "../lib/prisma";
import { WalletHolding, WalletState } from '../types/wallet.types';

export class WalletService {
  private readonly HYPERLIQUID_API = 'https://api.hyperliquid.xyz/info';

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

    const wallet = await prisma.wallet.create({
      data: {
        address,
        userId: user.id,
      },
    });

    return wallet;
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
    try {
      const response = await fetch(this.HYPERLIQUID_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: "spotClearinghouseState",
          user: address
        })
      });

      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }

      const data = await response.json();
      const holdings = data.balances || [];

      return {
        address,
        holdings: holdings.filter((holding: WalletHolding) => Number(holding.total) > 0)
      };
    } catch (error) {
      console.error('Error fetching wallet info:', error);
      throw error;
    }
  }

  public async getAllWalletsInfo(userId: number): Promise<WalletState[]> {
    const userWallets = await this.getWalletsByUser(userId);
    
    const walletsInfo = await Promise.all(
      userWallets.map(wallet => this.getWalletInfo(wallet.address))
    );

    return walletsInfo;
  }
}
