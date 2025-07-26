import { ProjectCreateInput, ProjectUpdateInput, ProjectResponse, ProjectCreateWithUploadInput } from '../../types/project.types';
import { 
  ProjectNotFoundError, 
  ProjectAlreadyExistsError,
  ProjectValidationError,
  CategoryNotFoundError 
} from '../../errors/project.errors';
import { logDeduplicator } from '../../utils/logDeduplicator';
import {CACHE_PREFIX } from '../../constants/cache.constants';
import { 
  projectCreateSchema, 
  projectUpdateSchema, 
  projectQuerySchema,
  projectCategoryUpdateSchema 
} from '../../schemas/project.schema';
import { projectRepository, categoryRepository } from '../../repositories';
import { transactionService } from '../../core/transaction.service';
import { BaseService } from '../../core/crudBase.service';
import { deleteUploadedFile } from '../../middleware/upload.middleware';

// Type pour les paramètres de requête
type ProjectQueryParams = {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
  categoryId?: number;
};

export class ProjectService extends BaseService<ProjectResponse, ProjectCreateInput, ProjectUpdateInput, ProjectQueryParams> {
  protected repository = projectRepository;
  protected cacheKeyPrefix = CACHE_PREFIX.PROJECT;
  protected validationSchemas = {
    create: projectCreateSchema,
    update: projectUpdateSchema,
    query: projectQuerySchema as any
  };
  protected errorClasses = {
    notFound: ProjectNotFoundError,
    alreadyExists: ProjectAlreadyExistsError,
    validation: ProjectValidationError
  };

  /**
   * Vérifie si un projet avec le titre donné existe déjà
   * @param data Données du projet
   * @returns true si le projet existe déjà, false sinon
   */
  protected async checkExists(data: ProjectCreateInput): Promise<boolean> {
    return await this.repository.existsByTitle(data.title);
  }

  /**
   * Vérifie si un projet avec le titre donné existe déjà (pour la mise à jour)
   * @param id ID du projet à mettre à jour
   * @param data Données de mise à jour
   * @returns true si un autre projet avec le même titre existe déjà, false sinon
   */
  protected async checkExistsForUpdate(id: number, data: ProjectUpdateInput): Promise<boolean> {
    if (data.title) {
      const project = await this.repository.findById(id);
      if (project && data.title !== project.title) {
        return await this.repository.existsByTitle(data.title);
      }
    }
    return false;
  }

  /**
   * Vérifie si un projet peut être supprimé
   * @param id ID du projet à supprimer
   * @throws Erreur si le projet ne peut pas être supprimé
   */
  protected async checkCanDelete(id: number): Promise<void> {
    // Aucune vérification spécifique pour la suppression d'un projet
    return;
  }

  /**
   * Met à jour la catégorie d'un projet
   * @param projectId ID du projet
   * @param categoryId ID de la catégorie ou null pour retirer la catégorie
   * @returns Projet mis à jour
   * @throws Erreur si le projet ou la catégorie n'existe pas
   */
  public async updateProjectCategory(projectId: number, categoryId: number | null) {
    try {
      // Validate input data
      const validationResult = projectCategoryUpdateSchema.safeParse({ categoryId });
      if (!validationResult.success) {
        throw new ProjectValidationError(validationResult.error.message);
      }

      // Utiliser le service de transaction pour la mise à jour de la catégorie
      const updatedProject = await transactionService.execute(async (tx) => {
        // Vérifier si le projet existe
        const project = await this.repository.findById(projectId);
        if (!project) {
          throw new ProjectNotFoundError();
        }

        // Si categoryId est fourni, vérifier si la catégorie existe
        if (categoryId !== null) {
          const category = await categoryRepository.findById(categoryId);
          if (!category) {
            throw new CategoryNotFoundError();
          }
        }

        // Mettre à jour la catégorie du projet
        return this.repository.updateCategory(projectId, categoryId);
      });

      // Invalider le cache
      await this.invalidateEntityCache(projectId);
      await this.invalidateEntityListCache();

      logDeduplicator.info('Project category updated successfully', { 
        projectId, 
        categoryId 
      });
      
      return updatedProject;
    } catch (error) {
      if (error instanceof ProjectNotFoundError || 
          error instanceof CategoryNotFoundError || 
          error instanceof ProjectValidationError) {
        throw error;
      }
      logDeduplicator.error('Error updating project category:', { 
        error, 
        projectId, 
        categoryId 
      });
      throw error;
    }
  }

  /**
   * Crée un projet avec gestion d'upload de fichier
   * @param data Données du projet avec logo optionnel
   * @returns Projet créé
   */
  public async createWithUpload(data: ProjectCreateWithUploadInput) {
    try {
      // Nettoyer les données
      const cleanData = { ...data };
      
      // Si logo est un objet vide ou undefined, le supprimer
      if (!cleanData.logo || (typeof cleanData.logo === 'object' && Object.keys(cleanData.logo).length === 0)) {
        delete cleanData.logo;
      }
      
      // Convertir categoryId en number si c'est une string
      if (cleanData.categoryId && typeof cleanData.categoryId === 'string') {
        cleanData.categoryId = parseInt(cleanData.categoryId, 10);
      }
      
      // Si pas de logo, utiliser une image par défaut
      const projectData: ProjectCreateInput = {
        ...cleanData,
        logo: cleanData.logo || 'https://via.placeholder.com/150x150.png?text=No+Logo'
      };

      // Vérifier si un projet avec le même titre existe déjà
      const exists = await this.checkExists(projectData);
      if (exists) {
        throw new ProjectAlreadyExistsError();
      }

      // Créer le projet directement avec le repository (sans validation du service de base)
      const project = await this.repository.create(projectData);
      
      // Invalider le cache
      await this.invalidateEntityListCache();

      logDeduplicator.info('Project created with upload successfully', { 
        id: project.id, 
        title: project.title 
      });

      return project;
    } catch (error) {
      logDeduplicator.error('Error creating project with upload:', { error, data });
      throw error;
    }
  }

  /**
   * Récupère tous les projets d'une catégorie
   * @param categoryId ID de la catégorie
   * @returns Liste des projets de la catégorie
   * @throws Erreur si la catégorie n'existe pas
   */
  public async getProjectsByCategory(categoryId: number) {
    try {
      // Vérifier si la catégorie existe
      const category = await categoryRepository.findById(categoryId);
      if (!category) {
        throw new CategoryNotFoundError();
      }

      const projects = await this.repository.findByCategory(categoryId);

      logDeduplicator.info('Projects by category retrieved successfully', { 
        categoryId,
        count: projects.length
      });
      
      return projects;
    } catch (error) {
      if (error instanceof CategoryNotFoundError) {
        throw error;
      }
      logDeduplicator.error('Error fetching projects by category:', { error, categoryId });
      throw error;
    }
  }

  /**
   * Supprime un projet et son fichier uploadé associé
   * @param id ID du projet à supprimer
   * @throws Erreur si le projet n'existe pas
   */
  async delete(id: number) {
    try {
      // Récupérer le projet avant suppression pour avoir l'URL du logo
      const project = await this.repository.findById(id);
      if (!project) {
        throw new this.errorClasses.notFound();
      }

      // Utiliser le service de transaction pour la suppression
      await transactionService.execute(async (tx) => {
        // Configurer le repository pour utiliser le client transactionnel
        this.repository.setPrismaClient(tx);
        
        // Vérifier si l'entité peut être supprimée
        await this.checkCanDelete(id);

        // Supprimer l'entité
        await this.repository.delete(id);
      });

      // Réinitialiser le client Prisma
      this.repository.resetPrismaClient();

      // Supprimer le fichier uploadé s'il existe et n'est pas l'image par défaut
      if (project.logo && 
          project.logo !== 'https://via.placeholder.com/150x150.png?text=No+Logo' &&
          project.logo.includes('/uploads/project-logos/')) {
        deleteUploadedFile(project.logo);
      }

      // Invalider le cache
      await this.invalidateEntityCache(id);
      await this.invalidateEntityListCache();

      logDeduplicator.info('Project deleted successfully with file cleanup', { id, logo: project.logo });
    } catch (error) {
      if (error instanceof this.errorClasses.notFound) {
        throw error;
      }
      logDeduplicator.error('Error deleting project:', { error, id });
      throw error;
    }
  }
} 