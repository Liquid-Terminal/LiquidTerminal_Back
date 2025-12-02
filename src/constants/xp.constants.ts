import { XpActionType } from '@prisma/client';

/**
 * Configuration des récompenses XP par action
 */
export const XP_REWARDS: Record<XpActionType, number> = {
    // Onboarding
    REGISTRATION: 100,

    // Engagement
    DAILY_LOGIN: 10,
    LOGIN_STREAK_7: 50,
    LOGIN_STREAK_30: 200,

    // Social
    REFERRAL_SUCCESS: 200,

    // Educational
    CREATE_EDUCATIONAL_CATEGORY: 30,
    ADD_EDUCATIONAL_RESOURCE: 25,

    // ReadLists
    CREATE_READLIST: 15,
    MARK_RESOURCE_READ: 5,
    COPY_PUBLIC_READLIST: 10,

    // Wallet Lists
    CREATE_WALLETLIST: 15,
    ADD_WALLET_TO_LIST: 10,

    // Public Goods
    SUBMIT_PUBLIC_GOOD: 100,
    PUBLIC_GOOD_APPROVED: 500,

    // Admin (valeur par défaut, peut être override)
    ADMIN_BONUS: 0,
    ADMIN_PENALTY: 0,
};

/**
 * Calcule le niveau à partir du total d'XP
 * Formule: XP requis pour niveau N = 100 × (N-1)^1.5
 */
export function calculateLevel(totalXp: number): number {
    if (totalXp <= 0) return 1;

    // Inverse de la formule: N = (XP / 100)^(2/3) + 1
    const level = Math.floor(Math.pow(totalXp / 100, 2 / 3) + 1);
    return Math.max(1, level);
}

/**
 * Calcule l'XP requis pour atteindre un niveau donné
 */
export function xpRequiredForLevel(level: number): number {
    if (level <= 1) return 0;
    return Math.floor(100 * Math.pow(level - 1, 1.5));
}

/**
 * Calcule la progression vers le prochain niveau (0-100%)
 */
export function calculateLevelProgress(totalXp: number): {
    currentLevel: number;
    currentLevelXp: number;
    nextLevelXp: number;
    progressPercent: number;
    xpToNextLevel: number;
} {
    const currentLevel = calculateLevel(totalXp);
    const currentLevelXp = xpRequiredForLevel(currentLevel);
    const nextLevelXp = xpRequiredForLevel(currentLevel + 1);

    const xpInCurrentLevel = totalXp - currentLevelXp;
    const xpNeededForNext = nextLevelXp - currentLevelXp;
    const progressPercent = Math.min(100, Math.floor((xpInCurrentLevel / xpNeededForNext) * 100));
    const xpToNextLevel = nextLevelXp - totalXp;

    return {
        currentLevel,
        currentLevelXp,
        nextLevelXp,
        progressPercent,
        xpToNextLevel,
    };
}

/**
 * Actions qui ne peuvent être effectuées qu'une seule fois
 */
export const ONE_TIME_ACTIONS: XpActionType[] = [
    'REGISTRATION',
];

/**
 * Actions limitées à une fois par jour
 */
export const DAILY_ACTIONS: XpActionType[] = [
    'DAILY_LOGIN',
];

/**
 * Nombre de jours pour les streaks
 */
export const STREAK_MILESTONES = {
    WEEK: 7,
    MONTH: 30,
} as const;





