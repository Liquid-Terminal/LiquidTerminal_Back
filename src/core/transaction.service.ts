import { PrismaClient } from '@prisma/client';
import { prisma } from './prisma.service';
import { logDeduplicator } from '../utils/logDeduplicator';

/**
 * Service de gestion des transactions
 * Permet d'exécuter des opérations dans un contexte transactionnel
 */
export class TransactionService {
  private prismaClient: PrismaClient = prisma;
  private isTransactionInProgress: boolean = false;

  /**
   * Configure le client Prisma à utiliser pour les transactions
   * @param prismaClient Client Prisma à utiliser
   */
  setPrismaClient(prismaClient: PrismaClient): void {
    this.prismaClient = prismaClient;
    logDeduplicator.info('Transaction service: Prisma client updated');
  }

  /**
   * Réinitialise le client Prisma à sa valeur par défaut
   */
  resetPrismaClient(): void {
    this.prismaClient = prisma;
    logDeduplicator.info('Transaction service: Prisma client reset to default');
  }

  /**
   * Vérifie si une transaction est en cours
   * @returns true si une transaction est en cours, false sinon
   */
  isTransactionActive(): boolean {
    return this.isTransactionInProgress;
  }

  /**
   * Exécute une opération dans un contexte transactionnel
   * @param operation Fonction à exécuter dans le contexte de la transaction
   * @returns Résultat de l'opération
   */
  async execute<T>(
    operation: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>
  ): Promise<T> {
    if (this.isTransactionInProgress) {
      logDeduplicator.warn('Transaction already in progress, this might lead to unexpected behavior');
    }

    try {
      this.isTransactionInProgress = true;
      logDeduplicator.info('Starting transaction', { timestamp: new Date().toISOString() });
      
      const result = await this.prismaClient.$transaction(operation);
      
      logDeduplicator.info('Transaction completed successfully', { 
        timestamp: new Date().toISOString(),
        resultType: typeof result
      });
      return result;
    } catch (error) {
      logDeduplicator.error('Transaction failed', { 
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
      throw error;
    } finally {
      this.isTransactionInProgress = false;
    }
  }
}

// Instance singleton du service de transaction
export const transactionService = new TransactionService(); 