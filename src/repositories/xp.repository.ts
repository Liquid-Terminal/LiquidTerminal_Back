import { PrismaClient, XpActionType, XpTransaction, User } from '@prisma/client';
import { prisma } from '../core/prisma.service';

export class XpRepository {
    private prismaClient: PrismaClient | Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'> = prisma;

    /**
     * Crée une transaction XP
     */
    async createTransaction(data: {
        userId: number;
        actionType: XpActionType;
        xpAmount: number;
        referenceId?: string;
        description?: string;
    }): Promise<XpTransaction> {
        return this.prismaClient.xpTransaction.create({
            data: {
                userId: data.userId,
                actionType: data.actionType,
                xpAmount: data.xpAmount,
                referenceId: data.referenceId || null,
                description: data.description || null,
            },
        });
    }

    /**
     * Vérifie si une transaction existe déjà (pour éviter les doublons)
     */
    async transactionExists(
        userId: number,
        actionType: XpActionType,
        referenceId?: string | null
    ): Promise<boolean> {
        // Use findFirst because referenceId is nullable and can't be used in composite unique with null
        const transaction = await this.prismaClient.xpTransaction.findFirst({
            where: {
                userId,
                actionType,
                referenceId: referenceId ?? null,
            },
        });
        return !!transaction;
    }

    /**
     * Vérifie si une action quotidienne a déjà été effectuée aujourd'hui
     */
    async hasDailyAction(userId: number, actionType: XpActionType): Promise<boolean> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const transaction = await this.prismaClient.xpTransaction.findFirst({
            where: {
                userId,
                actionType,
                createdAt: {
                    gte: today,
                    lt: tomorrow,
                },
            },
        });
        return !!transaction;
    }

    /**
     * Met à jour l'XP et le niveau d'un utilisateur
     */
    async updateUserXp(
        userId: number,
        totalXp: number,
        level: number
    ): Promise<User> {
        return this.prismaClient.user.update({
            where: { id: userId },
            data: { totalXp, level },
        });
    }

    /**
     * Met à jour le login streak d'un utilisateur
     */
    async updateLoginStreak(
        userId: number,
        loginStreak: number,
        lastLoginAt: Date
    ): Promise<User> {
        return this.prismaClient.user.update({
            where: { id: userId },
            data: { loginStreak, lastLoginAt },
        });
    }

    /**
     * Récupère l'historique des transactions XP d'un utilisateur
     */
    async getTransactionHistory(
        userId: number,
        options: {
            skip?: number;
            take?: number;
            actionType?: XpActionType;
        }
    ): Promise<XpTransaction[]> {
        return this.prismaClient.xpTransaction.findMany({
            where: {
                userId,
                ...(options.actionType && { actionType: options.actionType }),
            },
            orderBy: { createdAt: 'desc' },
            skip: options.skip,
            take: options.take,
        });
    }

    /**
     * Compte le nombre de transactions XP d'un utilisateur
     */
    async countTransactions(
        userId: number,
        actionType?: XpActionType
    ): Promise<number> {
        return this.prismaClient.xpTransaction.count({
            where: {
                userId,
                ...(actionType && { actionType }),
            },
        });
    }

    /**
     * Récupère le leaderboard XP
     */
    async getLeaderboard(options: {
        skip?: number;
        take?: number;
    }): Promise<Pick<User, 'id' | 'name' | 'totalXp' | 'level'>[]> {
        return this.prismaClient.user.findMany({
            where: {
                totalXp: { gt: 0 },
            },
            select: {
                id: true,
                name: true,
                totalXp: true,
                level: true,
            },
            orderBy: { totalXp: 'desc' },
            skip: options.skip,
            take: options.take,
        });
    }

    /**
     * Compte le nombre d'utilisateurs avec XP > 0
     */
    async countUsersWithXp(): Promise<number> {
        return this.prismaClient.user.count({
            where: { totalXp: { gt: 0 } },
        });
    }

    /**
     * Récupère le rang d'un utilisateur dans le leaderboard
     */
    async getUserRank(userId: number): Promise<number> {
        const user = await this.prismaClient.user.findUnique({
            where: { id: userId },
            select: { totalXp: true },
        });

        if (!user) return 0;

        const rank = await this.prismaClient.user.count({
            where: { totalXp: { gt: user.totalXp } },
        });

        return rank + 1;
    }

    /**
     * Récupère les stats XP d'un utilisateur
     */
    async getUserXpData(userId: number): Promise<Pick<User, 'totalXp' | 'level' | 'loginStreak' | 'lastLoginAt'> | null> {
        return this.prismaClient.user.findUnique({
            where: { id: userId },
            select: {
                totalXp: true,
                level: true,
                loginStreak: true,
                lastLoginAt: true,
            },
        });
    }
}

export const xpRepository = new XpRepository();

