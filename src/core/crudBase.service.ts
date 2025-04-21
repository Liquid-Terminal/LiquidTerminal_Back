import { z } from 'zod';
import { transactionService } from './transaction.service';
import { cacheService } from './cache.service';
import { logDeduplicator } from '../utils/logDeduplicator';
import { CACHE_TTL } from '../constants/cache.constants';

/**
 * Interface pour les paramètres de requête de base
 */
export interface BaseQueryParams {
  page?: number;
  limit?: number;
  [key: string]: any;
}

/**
 * Classe de base abstraite pour les services
 * Encapsule les fonctionnalités communes à tous les services
 */
export abstract class BaseService<T, CreateInput, UpdateInput, QueryParams extends BaseQueryParams> {
  /**
   * Repository utilisé par le service
   */
  protected abstract repository: any;

  /**
   * Préfixe pour les clés de cache
   */
  protected abstract cacheKeyPrefix: string;

  /**
   * Schémas de validation
   */
  protected abstract validationSchemas: {
    create: z.ZodSchema<CreateInput>;
    update: z.ZodSchema<UpdateInput>;
    query: z.ZodSchema<QueryParams>;
  };

  /**
   * Classes d'erreur utilisées par le service
   */
  protected abstract errorClasses: {
    notFound: new (message?: string) => Error;
    alreadyExists: new (message?: string) => Error;
    validation: new (message?: string) => Error;
  };

  /**
   * Invalide le cache d'une entité spécifique
   * @param id ID de l'entité
   */
  protected async invalidateEntityCache(id: number): Promise<void> {
    await cacheService.invalidate(`${this.cacheKeyPrefix}:${id}`);
  }
  
  /**
   * Invalide le cache des listes d'entités
   */
  protected async invalidateEntityListCache(): Promise<void> {
    await cacheService.invalidateByPattern(`${this.cacheKeyPrefix}*`);
  }
  
  /**
   * Valide les données d'entrée avec un schéma Zod
   * @param data Données à valider
   * @param schema Schéma de validation
   * @returns Données validées
   * @throws Erreur de validation si les données sont invalides
   */
  protected validateInput<T>(data: T, schema: z.ZodSchema<T>): T {
    const validationResult = schema.safeParse(data);
    if (!validationResult.success) {
      throw new this.errorClasses.validation(validationResult.error.message);
    }
    return validationResult.data;
  }

  /**
   * Récupère toutes les entités avec pagination, tri et filtrage
   * @param query Paramètres de requête
   * @returns Liste paginée d'entités
   */
  async getAll(query: QueryParams) {
    try {
      // Validate query parameters
      const validatedQuery = this.validateInput(query, this.validationSchemas.query);

      // Générer une clé de cache unique basée sur les paramètres de requête
      const cacheKey = `${this.cacheKeyPrefix}:list:${JSON.stringify(validatedQuery)}`;

      // Utiliser le service de cache pour récupérer ou mettre en cache les données
      return await cacheService.getOrSet(
        cacheKey,
        async () => {
          const result = await this.repository.findAll(validatedQuery);
          
          // Extraire les informations de pagination pour le logging
          const paginationInfo: Record<string, any> = {
            count: result.data.length,
            total: result.pagination.total
          };
          
          // Ajouter page et limit si disponibles
          if (validatedQuery.page !== undefined) {
            paginationInfo.page = validatedQuery.page;
          }
          if (validatedQuery.limit !== undefined) {
            paginationInfo.limit = validatedQuery.limit;
          }
          
          logDeduplicator.info(`${this.constructor.name}: Entities retrieved successfully`, paginationInfo);
          return result;
        },
        CACHE_TTL.MEDIUM
      );
    } catch (error) {
      if (error instanceof this.errorClasses.validation) {
        throw error;
      }
      logDeduplicator.error(`Error fetching entities in ${this.constructor.name}:`, { error, query });
      throw error;
    }
  }

  /**
   * Récupère une entité par son ID
   * @param id ID de l'entité
   * @returns Entité trouvée
   * @throws Erreur si l'entité n'est pas trouvée
   */
  async getById(id: number) {
    try {
      // Utiliser le service de cache pour récupérer ou mettre en cache l'entité
      return await cacheService.getOrSet(
        `${this.cacheKeyPrefix}:${id}`,
        async () => {
          const entity = await this.repository.findById(id);
          if (!entity) {
            throw new this.errorClasses.notFound();
          }
          logDeduplicator.info(`${this.constructor.name}: Entity retrieved successfully`, { id });
          return entity;
        },
        CACHE_TTL.MEDIUM
      );
    } catch (error) {
      if (error instanceof this.errorClasses.notFound) {
        throw error;
      }
      logDeduplicator.error(`Error fetching entity in ${this.constructor.name}:`, { error, id });
      throw error;
    }
  }

  /**
   * Crée une nouvelle entité
   * @param data Données de l'entité à créer
   * @returns Entité créée
   * @throws Erreur si l'entité existe déjà ou si les données sont invalides
   */
  async create(data: CreateInput) {
    try {
      // Validate input data
      const validatedData = this.validateInput(data, this.validationSchemas.create);

      // Utiliser le service de transaction pour la création
      const entity = await transactionService.execute(async (tx) => {
        // Configurer le repository pour utiliser le client transactionnel
        this.repository.setPrismaClient(tx);
        
        // Vérifier si une entité avec le même identifiant existe déjà
        const existingEntity = await this.checkExists(validatedData);
        if (existingEntity) {
          throw new this.errorClasses.alreadyExists();
        }

        // Créer l'entité
        return this.repository.create(validatedData);
      });

      // Réinitialiser le client Prisma
      this.repository.resetPrismaClient();

      // Mettre en cache la nouvelle entité
      await cacheService.getOrSet(
        `${this.cacheKeyPrefix}:${entity.id}`,
        async () => entity,
        CACHE_TTL.MEDIUM
      );

      // Invalider le cache des listes d'entités
      await this.invalidateEntityListCache();

      logDeduplicator.info(`${this.constructor.name}: Entity created successfully`, { id: entity.id });
      return entity;
    } catch (error) {
      if (error instanceof this.errorClasses.alreadyExists || error instanceof this.errorClasses.validation) {
        throw error;
      }
      logDeduplicator.error(`Error creating entity in ${this.constructor.name}:`, { error, data });
      throw error;
    }
  }

  /**
   * Met à jour une entité existante
   * @param id ID de l'entité à mettre à jour
   * @param data Données de mise à jour
   * @returns Entité mise à jour
   * @throws Erreur si l'entité n'existe pas ou si les données sont invalides
   */
  async update(id: number, data: UpdateInput) {
    try {
      // Validate input data
      const validatedData = this.validateInput(data, this.validationSchemas.update);

      // Utiliser le service de transaction pour la mise à jour
      const updatedEntity = await transactionService.execute(async (tx) => {
        // Configurer le repository pour utiliser le client transactionnel
        this.repository.setPrismaClient(tx);
        
        // Vérifier si l'entité existe
        const entity = await this.repository.findById(id);
        if (!entity) {
          throw new this.errorClasses.notFound();
        }

        // Vérifier si une entité avec le même identifiant existe déjà
        if (await this.checkExistsForUpdate(id, validatedData)) {
          throw new this.errorClasses.alreadyExists();
        }

        // Mettre à jour l'entité
        return this.repository.update(id, validatedData);
      });

      // Réinitialiser le client Prisma
      this.repository.resetPrismaClient();

      // Invalider le cache
      await this.invalidateEntityCache(id);
      await this.invalidateEntityListCache();

      // Mettre en cache l'entité mise à jour
      await cacheService.getOrSet(
        `${this.cacheKeyPrefix}:${id}`,
        async () => updatedEntity,
        CACHE_TTL.MEDIUM
      );

      logDeduplicator.info(`${this.constructor.name}: Entity updated successfully`, { id });
      return updatedEntity;
    } catch (error) {
      if (error instanceof this.errorClasses.notFound || 
          error instanceof this.errorClasses.alreadyExists || 
          error instanceof this.errorClasses.validation) {
        throw error;
      }
      logDeduplicator.error(`Error updating entity in ${this.constructor.name}:`, { error, id, data });
      throw error;
    }
  }

  /**
   * Supprime une entité
   * @param id ID de l'entité à supprimer
   * @throws Erreur si l'entité n'existe pas
   */
  async delete(id: number) {
    try {
      // Utiliser le service de transaction pour la suppression
      await transactionService.execute(async (tx) => {
        // Configurer le repository pour utiliser le client transactionnel
        this.repository.setPrismaClient(tx);
        
        // Vérifier si l'entité existe
        const entity = await this.repository.findById(id);
        if (!entity) {
          throw new this.errorClasses.notFound();
        }

        // Vérifier si l'entité peut être supprimée
        await this.checkCanDelete(id);

        // Supprimer l'entité
        await this.repository.delete(id);
      });

      // Réinitialiser le client Prisma
      this.repository.resetPrismaClient();

      // Invalider le cache
      await this.invalidateEntityCache(id);
      await this.invalidateEntityListCache();

      logDeduplicator.info(`${this.constructor.name}: Entity deleted successfully`, { id });
    } catch (error) {
      if (error instanceof this.errorClasses.notFound) {
        throw error;
      }
      logDeduplicator.error(`Error deleting entity in ${this.constructor.name}:`, { error, id });
      throw error;
    }
  }

  /**
   * Vérifie si une entité avec les données données existe déjà
   * @param data Données de l'entité
   * @returns true si l'entité existe déjà, false sinon
   */
  protected abstract checkExists(data: CreateInput): Promise<boolean>;

  /**
   * Vérifie si une entité avec les données de mise à jour existe déjà
   * @param id ID de l'entité à mettre à jour
   * @param data Données de mise à jour
   * @returns true si une autre entité avec les mêmes données existe déjà, false sinon
   */
  protected abstract checkExistsForUpdate(id: number, data: UpdateInput): Promise<boolean>;

  /**
   * Vérifie si une entité peut être supprimée
   * @param id ID de l'entité à supprimer
   * @throws Erreur si l'entité ne peut pas être supprimée
   */
  protected abstract checkCanDelete(id: number): Promise<void>;
} 