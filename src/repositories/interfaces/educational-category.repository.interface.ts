import { 
  EducationalCategoryResponse, 
  EducationalCategoryCreateInput, 
  EducationalCategoryUpdateInput
} from '../../types/educational.types';
import { BaseRepository } from './base.repository.interface';

export interface EducationalCategoryRepository extends BaseRepository {
  /**
   * Récupère toutes les catégories éducatives avec pagination, tri et filtrage
   */
  findAll(params: {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    search?: string;
    createdBy?: number;
  }): Promise<{
    data: EducationalCategoryResponse[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }>;

  /**
   * Récupère une catégorie éducative par son ID
   */
  findById(id: number): Promise<EducationalCategoryResponse | null>;



  /**
   * Crée une nouvelle catégorie éducative
   */
  create(data: EducationalCategoryCreateInput): Promise<EducationalCategoryResponse>;

  /**
   * Met à jour une catégorie éducative existante
   */
  update(id: number, data: EducationalCategoryUpdateInput): Promise<EducationalCategoryResponse>;

  /**
   * Supprime une catégorie éducative
   */
  delete(id: number): Promise<void>;

  /**
   * Vérifie si une catégorie éducative existe avec le nom donné
   */
  existsByName(name: string): Promise<boolean>;

  /**
   * Récupère toutes les ressources d'une catégorie éducative
   */
  getResourcesByCategory(categoryId: number): Promise<any[]>;

  /**
   * Récupère les catégories éducatives créées par un utilisateur
   */
  findByCreator(userId: number): Promise<EducationalCategoryResponse[]>;
} 