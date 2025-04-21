import { Project, ProjectCreateInput, ProjectUpdateInput } from '../../types/project.types';
import { BaseRepository } from './base.repository.interface';

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
    categoryId?: number;
  }): Promise<{
    data: Project[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
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
   * Met à jour la catégorie d'un projet
   */
  updateCategory(projectId: number, categoryId: number | null): Promise<Project>;

  /**
   * Récupère tous les projets d'une catégorie
   */
  findByCategory(categoryId: number): Promise<Project[]>;
} 