import prisma from "../../lib/prisma";
import { logger } from "../../utils/logger";
import { WalletAlreadyExistsError, UserNotFoundError } from "../../errors/wallet.errors";

export class WalletService {
  private static instance: WalletService;

  private constructor() {}

  public static getInstance(): WalletService {
    if (!WalletService.instance) {
      WalletService.instance = new WalletService();
    }
    return WalletService.instance;
  }

  public async addWallet(privyUserId: string, address: string) {
    try {
      // Validation basique de l'adresse (42 caractères, commence par 0x)
      if (!address || address.length !== 42 || !address.startsWith('0x')) {
        logger.warn('Invalid wallet address format', { address });
        throw new Error('Invalid wallet address format');
      }

      const user = await prisma.user.findUnique({
        where: { privyUserId },
      });

      if (!user) {
        logger.warn('User not found', { privyUserId });
        throw new UserNotFoundError();
      }

      const existingWallet = await prisma.wallet.findUnique({
        where: { address },
      });

      if (existingWallet) {
        logger.warn('Wallet already exists', { address });
        throw new WalletAlreadyExistsError();
      }

      const wallet = await prisma.wallet.create({
        data: {
          address,
          userId: user.id,
        },
      });

      logger.info('Wallet added successfully', { address, userId: user.id });
      return wallet;
    } catch (error) {
      if (error instanceof WalletAlreadyExistsError || 
          error instanceof UserNotFoundError) {
        throw error;
      }
      logger.error('Error adding wallet:', { error, privyUserId, address });
      throw error;
    }
  }

  public async getWalletsByUser(userId: number) {
    try {
      const wallets = await prisma.wallet.findMany({
        where: { userId },
        orderBy: {
          addedAt: 'desc'
        }
      });

      logger.info('Wallets retrieved successfully', { userId, count: wallets.length });
      return wallets;
    } catch (error) {
      logger.error('Error retrieving wallets:', { error, userId });
      throw error;
    }
  }
}
