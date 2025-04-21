import { BaseService } from '../../core/crudBase.service';
import { walletRepository } from '../../repositories/wallet.repository';
import { 
  WalletCreateInput, 
  WalletUpdateInput, 
  WalletResponse,
  WalletQueryParams 
} from '../../types/wallet.types';
import { 
  WalletNotFoundError, 
  WalletAlreadyExistsError,
  WalletValidationError,
  UserNotFoundError 
} from '../../errors/wallet.errors';
import { 
  walletCreateSchema, 
  walletUpdateSchema, 
  walletQuerySchema 
} from '../../schemas/wallet.schema';
import { CACHE_PREFIX } from '../../constants/cache.constants';
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
    if (data.address) {
      const wallet = await this.repository.findById(id);
      if (wallet && data.address !== wallet.address) {
        return await this.repository.existsByAddress(data.address);
      }
    }
    return false;
  }

  protected async checkCanDelete(id: number): Promise<void> {
    // Vérifications spécifiques pour la suppression d'un wallet
    return;
  }

  /**
   * Ajoute un wallet pour un utilisateur
   */
  public async addWallet(privyUserId: string, address: string) {
    try {
      // Validation de l'adresse Ethereum
      if (!this.validateEthereumAddress(address)) {
        throw new WalletValidationError('Invalid Ethereum address format');
      }

      // Utiliser le service de transaction pour l'ajout du wallet
      const wallet = await transactionService.execute(async (tx) => {
        // Configurer le repository pour utiliser le client transactionnel
        this.repository.setPrismaClient(tx);

        // Vérifier si l'utilisateur existe
        const user = await tx.user.findUnique({
          where: { privyUserId }
        });

        if (!user) {
          throw new UserNotFoundError();
        }

        // Vérifier si le wallet existe déjà
        if (await this.repository.existsByAddress(address)) {
          throw new WalletAlreadyExistsError();
        }

        // Créer le wallet
        return this.repository.create({
          address,
          userId: user.id
        });
      });

      // Invalider le cache
      await this.invalidateEntityListCache();

      logDeduplicator.info('Wallet added successfully', { 
        address, 
        userId: wallet.userId 
      });

      return wallet;
    } catch (error) {
      if (error instanceof WalletAlreadyExistsError || 
          error instanceof UserNotFoundError ||
          error instanceof WalletValidationError) {
        throw error;
      }
      logDeduplicator.error('Error adding wallet:', { 
        error, 
        privyUserId, 
        address 
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
        // Configurer le repository pour utiliser le client transactionnel
        this.repository.setPrismaClient(tx);

        const [wallets, total] = await Promise.all([
          this.repository.findByUser(userId, { skip, take: limit }),
          this.repository.countByUser(userId)
        ]);

        return { wallets, total };
      });

      // Réinitialiser le client Prisma
      this.repository.resetPrismaClient();

      logDeduplicator.info('Wallets retrieved successfully', { 
        userId, 
        count: result.wallets.length,
        total: result.total,
        page,
        limit
      });

      return {
        data: result.wallets,
        pagination: {
          total: result.total,
          page,
          limit,
          pages: Math.ceil(result.total / limit)
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
}