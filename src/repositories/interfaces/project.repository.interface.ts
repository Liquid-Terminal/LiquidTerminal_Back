import { Project, ProjectCreateInput, ProjectUpdateInput } from '../../types/project.types';
import { BaseRepository } from './base.repository.interface';
import { BasePagination } from '../../types/common.types';

export interface ProjectRepository extends BaseRepository {
  /**
   * Récupère tous les projets avec pagination, tri et filtrage
   */
  findAll(params: {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    search?: string;
    categoryIds?: number[];
  }): Promise<{
    data: Project[];
    pagination: BasePagination;
  }>;

  /**
   * Récupère un projet par son ID
   */
  findById(id: number): Promise<Project | null>;

  /**
   * Crée un nouveau projet
   */
  create(data: ProjectCreateInput): Promise<Project>;

  /**
   * Met à jour un projet existant
   */
  update(id: number, data: ProjectUpdateInput): Promise<Project>;

  /**
   * Supprime un projet
   */
  delete(id: number): Promise<void>;

  /**
   * Vérifie si un projet existe avec le titre donné
   */
  existsByTitle(title: string): Promise<boolean>;

  /**
   * Assigne des catégories à un projet
   */
  assignCategories(projectId: number, categoryIds: number[]): Promise<void>;

  /**
   * Retire des catégories d'un projet
   */
  removeCategories(projectId: number, categoryIds: number[]): Promise<void>;

  /**
   * Récupère toutes les catégories d'un projet
   */
  getProjectCategories(projectId: number): Promise<any[]>;
} 