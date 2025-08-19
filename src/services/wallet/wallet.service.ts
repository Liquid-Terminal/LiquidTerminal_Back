import { BaseService } from '../../core/crudBase.service';
import { walletRepository } from '../../repositories/wallet.repository';
import { userWalletRepository } from '../../repositories/userWallet.repository';
import { 
  WalletCreateInput, 
  WalletUpdateInput, 
  WalletResponse,
  WalletQueryParams,
  UserWalletResponse 
} from '../../types/wallet.types';
import { 
  WalletNotFoundError, 
  WalletAlreadyExistsError,
  WalletValidationError,
  UserNotFoundError,
  WalletLimitExceededError
} from '../../errors/wallet.errors';
import { 
  walletCreateSchema, 
  walletUpdateSchema, 
  walletQuerySchema 
} from '../../schemas/wallet.schema';
import { CACHE_PREFIX } from '../../constants/cache.constants';
import { WALLET_CONSTANTS } from '../../constants/wallet.constants';
import { transactionService } from '../../core/transaction.service';
import { logDeduplicator } from '../../utils/logDeduplicator';

export class WalletService extends BaseService<WalletResponse, WalletCreateInput, WalletUpdateInput, WalletQueryParams> {
  protected repository = walletRepository;
  protected cacheKeyPrefix = CACHE_PREFIX.WALLET;
  protected validationSchemas = {
    create: walletCreateSchema,
    update: walletUpdateSchema,
    query: walletQuerySchema
  };
  protected errorClasses = {
    notFound: WalletNotFoundError,
    alreadyExists: WalletAlreadyExistsError,
    validation: WalletValidationError
  };

  /**
   * Valide une adresse Ethereum
   */
  private validateEthereumAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  protected async checkExists(data: WalletCreateInput): Promise<boolean> {
    return await this.repository.existsByAddress(data.address);
  }

  protected async checkExistsForUpdate(id: number, data: WalletUpdateInput): Promise<boolean> {
    return false; // Nous ne permettons pas de modifier l'adresse
  }

  protected async checkCanDelete(id: number): Promise<void> {
    // Vérifier si le wallet a des transactions
    // Cette méthode sera implémentée plus tard
  }

  /**
   * Ajoute un wallet pour un utilisateur
   */
  public async addWallet(privyUserId: string, address: string, name?: string) {
    try {
      // Validation de l'adresse Ethereum
      if (!this.validateEthereumAddress(address)) {
        throw new WalletValidationError('Invalid Ethereum address format');
      }

      // Utiliser le service de transaction pour l'ajout du wallet
      const userWallet = await transactionService.execute(async (tx) => {
        // Configurer les repositories pour utiliser le client transactionnel
        this.repository.setPrismaClient(tx);
        userWalletRepository.setPrismaClient(tx);

        // Vérifier si l'utilisateur existe
        const user = await tx.user.findUnique({
          where: { privyUserId }
        });

        if (!user) {
          throw new UserNotFoundError();
        }

        // Vérifier la limite de wallets par utilisateur
        const userWalletCount = await userWalletRepository.countByUser(user.id);
        if (userWalletCount >= WALLET_CONSTANTS.MAX_WALLETS_PER_USER) {
          throw new WalletLimitExceededError();
        }

        // Vérifier si le wallet existe déjà
        let wallet = await this.repository.findByAddress(address);
        
        if (!wallet) {
          // Créer le wallet s'il n'existe pas
          wallet = await this.repository.create({
            address
          });
        } else {
          // Vérifier si l'utilisateur a déjà ce wallet
          const existingUserWallet = await userWalletRepository.findByUserAndWallet(user.id, wallet.id);
          if (existingUserWallet) {
            throw new WalletAlreadyExistsError();
          }
        }

        // Créer l'association utilisateur-wallet
        return await userWalletRepository.create({
          userId: user.id,
          walletId: wallet.id,
          name
        });
      });

      // Invalider le cache
      await this.invalidateEntityListCache();

      logDeduplicator.info('Wallet added successfully', { 
        address, 
        userId: userWallet.userId,
        walletId: userWallet.walletId
      });

      return userWallet;
    } catch (error) {
      if (error instanceof WalletAlreadyExistsError || 
          error instanceof UserNotFoundError ||
          error instanceof WalletValidationError ||
          error instanceof WalletLimitExceededError) {
        throw error;
      }
      logDeduplicator.error('Error adding wallet:', { 
        error, 
        privyUserId, 
        address,
        name
      });
      throw error;
    }
  }

  /**
   * Récupère les wallets d'un utilisateur avec pagination
   */
  public async getWalletsByUser(userId: number, page: number = 1, limit: number = 10) {
    try {
      const skip = (page - 1) * limit;
      
      // Utiliser le service de transaction pour la récupération des wallets
      const result = await transactionService.execute(async (tx) => {
        // Configurer les repositories pour utiliser le client transactionnel
        this.repository.setPrismaClient(tx);
        userWalletRepository.setPrismaClient(tx);

        const [userWallets, total] = await Promise.all([
          userWalletRepository.findByUser(userId, { skip, take: limit }),
          userWalletRepository.countByUser(userId)
        ]);

        return { userWallets, total };
      });

      // Réinitialiser les clients Prisma
      this.repository.resetPrismaClient();
      userWalletRepository.resetPrismaClient();

      logDeduplicator.info('Wallets retrieved successfully', { 
        userId, 
        count: result.userWallets.length,
        total: result.total,
        page,
        limit
      });

      return {
        data: result.userWallets.map(uw => ({
          id: uw.id,
          userId: uw.userId,
          walletId: uw.walletId,
          name: uw.name,
          addedAt: uw.addedAt,
          wallet: {
            id: uw.Wallet.id,
            address: uw.Wallet.address,
            addedAt: uw.Wallet.addedAt
          }
        })),
        pagination: {
          total: result.total,
          page,
          limit,
          totalPages: Math.ceil(result.total / limit),
          hasNext: page < Math.ceil(result.total / limit),
          hasPrevious: page > 1
        }
      };
    } catch (error) {
      logDeduplicator.error('Error retrieving wallets:', { 
        error, 
        userId 
      });
      throw error;
    }
  }

  /**
   * Supprime un wallet d'un utilisateur
   * @param walletId ID du wallet à supprimer
   * @param userId ID de l'utilisateur
   * @throws Erreur si le wallet n'est pas trouvé
   */
  public async removeWalletFromUser(walletId: number, userId: number): Promise<void> {
    try {
      // Utiliser le service de transaction pour la suppression
      await transactionService.execute(async (tx) => {
        // Configurer les repositories pour utiliser le client transactionnel
        this.repository.setPrismaClient(tx);
        userWalletRepository.setPrismaClient(tx);
        
        // Vérifier si l'association existe
        const userWallet = await userWalletRepository.findByUserAndWallet(userId, walletId);
        if (!userWallet) {
          throw new WalletNotFoundError();
        }

        // Supprimer l'association
        await userWalletRepository.delete(userWallet.id);
      });

      // Réinitialiser les clients Prisma
      this.repository.resetPrismaClient();
      userWalletRepository.resetPrismaClient();

      // Invalider le cache
      await this.invalidateEntityListCache();

      logDeduplicator.info('Wallet removed from user successfully', { walletId, userId });
    } catch (error) {
      if (error instanceof WalletNotFoundError) {
        throw error;
      }
      logDeduplicator.error('Error removing wallet from user:', { error, walletId, userId });
      throw error;
    }
  }

  /**
   * Met à jour le nom d'un wallet pour un utilisateur spécifique
   * @param userId ID de l'utilisateur
   * @param walletId ID du wallet
   * @param name Nouveau nom du wallet
   * @returns Le UserWallet mis à jour
   */
  public async updateWalletName(userId: number, walletId: number, name: string) {
    try {
      // Valider le nom
      const validationResult = walletUpdateSchema.shape.name.safeParse(name);
      if (!validationResult.success) {
        throw new WalletValidationError('Invalid wallet name');
      }

      // Utiliser le service de transaction pour la mise à jour
      const updatedUserWallet = await transactionService.execute(async (tx) => {
        // Configurer les repositories pour utiliser le client transactionnel
        this.repository.setPrismaClient(tx);
        userWalletRepository.setPrismaClient(tx);
        
        // Vérifier si l'association existe
        const userWallet = await userWalletRepository.findByUserAndWallet(userId, walletId);
        if (!userWallet) {
          throw new WalletNotFoundError();
        }

        // Mettre à jour le nom
        return await userWalletRepository.updateName(userWallet.id, name);
      });

      // Réinitialiser les clients Prisma
      this.repository.resetPrismaClient();
      userWalletRepository.resetPrismaClient();

      // Invalider le cache
      await this.invalidateEntityListCache();

      logDeduplicator.info('Wallet name updated successfully', { 
        userId, 
        walletId, 
        name 
      });

      return updatedUserWallet;
    } catch (error) {
      if (error instanceof WalletNotFoundError || 
          error instanceof WalletValidationError) {
        throw error;
      }
      logDeduplicator.error('Error updating wallet name:', { 
        error, 
        userId, 
        walletId, 
        name 
      });
      throw error;
    }
  }
}