import { 
  EducationalResourceResponse, 
  EducationalResourceCreateInput, 
  EducationalResourceUpdateInput,
  EducationalResourceCategoryCreateInput,
  EducationalResourceCategoryResponse 
} from '../../types/educational.types';
import { BaseRepository } from './base.repository.interface';

export interface EducationalResourceRepository extends BaseRepository {
  /**
   * Récupère toutes les ressources éducatives avec pagination, tri et filtrage
   */
  findAll(params: {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    search?: string;
    addedBy?: number;
    categoryId?: number;
  }): Promise<{
    data: EducationalResourceResponse[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }>;

  /**
   * Récupère une ressource éducative par son ID
   */
  findById(id: number): Promise<EducationalResourceResponse | null>;



  /**
   * Crée une nouvelle ressource éducative
   */
  create(data: EducationalResourceCreateInput): Promise<EducationalResourceResponse>;

  /**
   * Met à jour une ressource éducative existante
   */
  update(id: number, data: EducationalResourceUpdateInput): Promise<EducationalResourceResponse>;

  /**
   * Supprime une ressource éducative
   */
  delete(id: number): Promise<void>;

  /**
   * Vérifie si une ressource éducative existe avec l'URL donnée
   */
  existsByUrl(url: string): Promise<boolean>;

  /**
   * Récupère les ressources éducatives ajoutées par un utilisateur
   */
  findByCreator(userId: number): Promise<EducationalResourceResponse[]>;

  /**
   * Récupère les ressources d'une catégorie spécifique
   */
  findByCategory(categoryId: number): Promise<EducationalResourceResponse[]>;

  /**
   * Assigne une ressource à une catégorie
   */
  assignToCategory(data: EducationalResourceCategoryCreateInput): Promise<EducationalResourceCategoryResponse>;

  /**
   * Retire une ressource d'une catégorie
   */
  removeFromCategory(resourceId: number, categoryId: number): Promise<void>;

  /**
   * Vérifie si une ressource est assignée à une catégorie
   */
  isAssignedToCategory(resourceId: number, categoryId: number): Promise<boolean>;

  /**
   * Récupère toutes les assignations d'une ressource
   */
  getResourceAssignments(resourceId: number): Promise<EducationalResourceCategoryResponse[]>;
} 