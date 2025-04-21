import { PrismaClient } from '@prisma/client';

/**
 * Interface de base pour les repositories
 * Définit les méthodes communes à tous les repositories
 */
export interface BaseRepository {
  /**
   * Définit le client Prisma à utiliser pour les opérations de base de données
   * @param prismaClient Client Prisma à utiliser
   */
  setPrismaClient(prismaClient: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>): void;

  /**
   * Réinitialise le client Prisma à sa valeur par défaut
   */
  resetPrismaClient(): void;
} 