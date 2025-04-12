import prisma from "../../lib/prisma";

export class WalletService {

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
}
