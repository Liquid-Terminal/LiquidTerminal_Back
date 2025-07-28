import { User, UserRole } from '@prisma/client';
import { userRepository } from '../../repositories/user.repository';
import { logDeduplicator } from '../../utils/logDeduplicator';
import { AdminUserUpdateInput } from '../../schemas/auth.schema';

export class UserService {
  private static instance: UserService;

  private constructor() { }

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  /**
   * Récupère la liste des utilisateurs avec pagination et filtres
   */
  async getUsers(options: {
    page?: number;
    limit?: number;
    search?: string;
    verified?: boolean;
  }): Promise<{ users: User[]; total: number; pages: number }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    try {
      const [users, total] = await Promise.all([
        userRepository.findMany({
          skip,
          take: limit,
          search: options.search,
          verified: options.verified,
          orderBy: { createdAt: 'desc' }
        }),
        userRepository.count({
          search: options.search,
          verified: options.verified
        })
      ]);

      return {
        users,
        total,
        pages: Math.ceil(total / limit)
      };
    } catch (error) {
      logDeduplicator.error('Error getting users list', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        options
      });
      throw error;
    }
  }

  /**
   * Récupère un utilisateur par son ID
   */
  async getUserById(userId: number): Promise<User | null> {
    try {
      return await userRepository.findById(userId);
    } catch (error) {
      logDeduplicator.error('Error getting user by ID', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId
      });
      throw error;
    }
  }

  /**
   * Met à jour un utilisateur
   */
  async updateUser(userId: number, updateData: AdminUserUpdateInput): Promise<User> {
    try {
      // Validation des données avant mise à jour
      if (updateData.email !== undefined && updateData.email !== null) {
        const emailExists = await userRepository.existsByEmail(updateData.email, userId);
        if (emailExists) {
          throw new Error('Email already exists');
        }
      }

      return await userRepository.update(userId, updateData);
    } catch (error) {
      logDeduplicator.error('Error updating user', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId,
        updateData
      });
      throw error;
    }
  }

  /**
   * Supprime un utilisateur
   */
  async deleteUser(userId: number): Promise<User> {
    try {
      return await userRepository.delete(userId);
    } catch (error) {
      logDeduplicator.error('Error deleting user', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId
      });
      throw error;
    }
  }

  /**
   * Vérifie si un utilisateur peut être supprimé (pas d'admin qui se supprime lui-même)
   */
  canDeleteUser(userId: number, currentAdminId: number): boolean {
    return userId !== currentAdminId;
  }
} 