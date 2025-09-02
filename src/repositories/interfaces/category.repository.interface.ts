import { CategoryResponse, CategoryCreateInput, CategoryUpdateInput, CategoryWithProjects } from '../../types/project.types';
import { BaseRepository } from './base.repository.interface';
import { BasePagination } from '../../types/common.types';

export interface CategoryRepository extends BaseRepository {
  /**
   * Récupère toutes les catégories avec pagination, tri et filtrage
   */
  findAll(params: {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    search?: string;
  }): Promise<{
    data: CategoryResponse[];
    pagination: BasePagination;
  }>;

  /**
   * Récupère une catégorie par son ID
   */
  findById(id: number): Promise<CategoryResponse | null>;

  /**
   * Récupère une catégorie avec ses projets
   */
  findByIdWithProjects(id: number): Promise<CategoryWithProjects | null>;

  /**
   * Crée une nouvelle catégorie
   */
  create(data: CategoryCreateInput): Promise<CategoryResponse>;

  /**
   * Met à jour une catégorie existante
   */
  update(id: number, data: CategoryUpdateInput): Promise<CategoryResponse>;

  /**
   * Supprime une catégorie
   */
  delete(id: number): Promise<void>;

  /**
   * Vérifie si une catégorie existe avec le nom donné
   */
  existsByName(name: string): Promise<boolean>;

  /**
   * Trouve une catégorie par son nom (case-insensitive)
   */
  findByName(name: string): Promise<CategoryResponse | null>;

  /**
   * Récupère tous les projets d'une catégorie
   */
  getProjectsByCategory(categoryId: number): Promise<any[]>;
} 