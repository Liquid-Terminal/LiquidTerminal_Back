import { XpActionType, User } from '@prisma/client';
import { xpRepository } from '../../repositories/xp.repository';
import { userRepository } from '../../repositories/user.repository';
import { logDeduplicator } from '../../utils/logDeduplicator';
import {
  XP_REWARDS,
  calculateLevel,
  calculateLevelProgress,
  ONE_TIME_ACTIONS,
  DAILY_ACTIONS,
  STREAK_MILESTONES,
} from '../../constants/xp.constants';
import {
  UserXpStats,
  XpLeaderboardResponse,
  GrantXpInput,
  XpTransactionHistoryResponse,
} from '../../types/xp.types';

export class XpService {
  private static instance: XpService;

  private constructor() {}

  public static getInstance(): XpService {
    if (!XpService.instance) {
      XpService.instance = new XpService();
    }
    return XpService.instance;
  }

  /**
   * Attribue de l'XP à un utilisateur pour une action
   * @returns L'XP attribué (0 si action déjà effectuée)
   */
  async grantXp(input: GrantXpInput): Promise<number> {
    const { userId, actionType, referenceId, description, customXpAmount } = input;

    try {
      // Vérifier si c'est une action unique déjà effectuée
      if (ONE_TIME_ACTIONS.includes(actionType)) {
        const exists = await xpRepository.transactionExists(userId, actionType, referenceId);
        if (exists) {
          logDeduplicator.info('XP action already granted (one-time)', { userId, actionType });
          return 0;
        }
      }

      // Vérifier si c'est une action quotidienne déjà effectuée aujourd'hui
      if (DAILY_ACTIONS.includes(actionType)) {
        const hasDone = await xpRepository.hasDailyAction(userId, actionType);
        if (hasDone) {
          logDeduplicator.info('XP action already granted today', { userId, actionType });
          return 0;
        }
      }

      // Vérifier les doublons pour les actions avec référence
      if (referenceId) {
        const exists = await xpRepository.transactionExists(userId, actionType, referenceId);
        if (exists) {
          logDeduplicator.info('XP action already granted for this reference', { 
            userId, actionType, referenceId 
          });
          return 0;
        }
      }

      // Calculer l'XP à attribuer
      const xpAmount = customXpAmount ?? XP_REWARDS[actionType];

      // Créer la transaction XP
      await xpRepository.createTransaction({
        userId,
        actionType,
        xpAmount,
        referenceId,
        description,
      });

      // Mettre à jour le total XP et le niveau de l'utilisateur
      const user = await userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const newTotalXp = user.totalXp + xpAmount;
      const newLevel = calculateLevel(newTotalXp);

      await xpRepository.updateUserXp(userId, newTotalXp, newLevel);

      // Log level up
      if (newLevel > user.level) {
        logDeduplicator.info('User leveled up!', { 
          userId, 
          oldLevel: user.level, 
          newLevel,
          totalXp: newTotalXp
        });
      }

      logDeduplicator.info('XP granted successfully', { 
        userId, 
        actionType, 
        xpAmount,
        newTotalXp,
        newLevel 
      });

      return xpAmount;
    } catch (error) {
      logDeduplicator.error('Error granting XP', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        actionType,
      });
      throw error;
    }
  }

  /**
   * Gère le login quotidien et les streaks
   */
  async handleDailyLogin(userId: number): Promise<{
    xpGranted: number;
    streakBonus: number;
    newStreak: number;
  }> {
    try {
      const user = await userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const now = new Date();
      const lastLogin = user.lastLoginAt;
      let newStreak = user.loginStreak;
      let streakBonus = 0;

      // Calculer le streak
      if (lastLogin) {
        const lastLoginDate = new Date(lastLogin);
        lastLoginDate.setHours(0, 0, 0, 0);
        
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        
        const daysDiff = Math.floor((today.getTime() - lastLoginDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff === 0) {
          // Déjà connecté aujourd'hui, pas de changement
          return { xpGranted: 0, streakBonus: 0, newStreak };
        } else if (daysDiff === 1) {
          // Jour consécutif
          newStreak += 1;
        } else {
          // Streak cassé
          newStreak = 1;
        }
      } else {
        // Premier login
        newStreak = 1;
      }

      // Mettre à jour le streak
      await xpRepository.updateLoginStreak(userId, newStreak, now);

      // Attribuer l'XP du login quotidien
      const xpGranted = await this.grantXp({
        userId,
        actionType: 'DAILY_LOGIN',
        referenceId: now.toISOString().split('T')[0], // Date du jour
      });

      // Vérifier les bonus de streak
      if (newStreak === STREAK_MILESTONES.WEEK) {
        streakBonus = await this.grantXp({
          userId,
          actionType: 'LOGIN_STREAK_7',
          referenceId: `streak-7-${Math.floor(newStreak / STREAK_MILESTONES.WEEK)}`,
        });
      } else if (newStreak === STREAK_MILESTONES.MONTH) {
        streakBonus = await this.grantXp({
          userId,
          actionType: 'LOGIN_STREAK_30',
          referenceId: `streak-30-${Math.floor(newStreak / STREAK_MILESTONES.MONTH)}`,
        });
      }

      logDeduplicator.info('Daily login handled', { 
        userId, 
        newStreak, 
        xpGranted, 
        streakBonus 
      });

      return { xpGranted, streakBonus, newStreak };
    } catch (error) {
      logDeduplicator.error('Error handling daily login', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      throw error;
    }
  }

  /**
   * Récupère les statistiques XP d'un utilisateur
   */
  async getUserXpStats(userId: number): Promise<UserXpStats> {
    try {
      const userData = await xpRepository.getUserXpData(userId);
      if (!userData) {
        throw new Error('User not found');
      }

      const progress = calculateLevelProgress(userData.totalXp);

      return {
        totalXp: userData.totalXp,
        level: userData.level,
        currentLevelXp: progress.currentLevelXp,
        nextLevelXp: progress.nextLevelXp,
        progressPercent: progress.progressPercent,
        xpToNextLevel: progress.xpToNextLevel,
        loginStreak: userData.loginStreak,
        lastLoginAt: userData.lastLoginAt,
      };
    } catch (error) {
      logDeduplicator.error('Error getting user XP stats', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      throw error;
    }
  }

  /**
   * Récupère l'historique des transactions XP d'un utilisateur
   */
  async getTransactionHistory(
    userId: number,
    options: { page?: number; limit?: number; actionType?: XpActionType }
  ): Promise<XpTransactionHistoryResponse> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100);
    const skip = (page - 1) * limit;

    try {
      const [transactions, total] = await Promise.all([
        xpRepository.getTransactionHistory(userId, {
          skip,
          take: limit,
          actionType: options.actionType,
        }),
        xpRepository.countTransactions(userId, options.actionType),
      ]);

      return {
        transactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logDeduplicator.error('Error getting XP transaction history', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      throw error;
    }
  }

  /**
   * Récupère le leaderboard XP
   */
  async getLeaderboard(options: {
    page?: number;
    limit?: number;
    userId?: number; // Pour récupérer le rang de l'utilisateur actuel
  }): Promise<XpLeaderboardResponse> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100);
    const skip = (page - 1) * limit;

    try {
      const [users, total] = await Promise.all([
        xpRepository.getLeaderboard({ skip, take: limit }),
        xpRepository.countUsersWithXp(),
      ]);

      const leaderboard = users.map((user, index) => ({
        rank: skip + index + 1,
        userId: user.id,
        name: user.name,
        totalXp: user.totalXp,
        level: user.level,
      }));

      let userRank: number | undefined;
      if (options.userId) {
        userRank = await xpRepository.getUserRank(options.userId);
      }

      return {
        leaderboard,
        userRank,
        total,
      };
    } catch (error) {
      logDeduplicator.error('Error getting XP leaderboard', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Bonus admin (ajout manuel d'XP)
   */
  async adminGrantXp(
    adminId: number,
    targetUserId: number,
    xpAmount: number,
    description: string
  ): Promise<number> {
    const actionType = xpAmount >= 0 ? 'ADMIN_BONUS' : 'ADMIN_PENALTY';
    
    logDeduplicator.info('Admin XP grant', { 
      adminId, 
      targetUserId, 
      xpAmount, 
      description 
    });

    return this.grantXp({
      userId: targetUserId,
      actionType,
      customXpAmount: Math.abs(xpAmount) * (xpAmount >= 0 ? 1 : -1),
      referenceId: `admin-${adminId}-${Date.now()}`,
      description,
    });
  }
}

export const xpService = XpService.getInstance();





