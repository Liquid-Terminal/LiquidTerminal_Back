import { 
  LinkPreviewResponse, 
  LinkPreviewCreateInput, 
  LinkPreviewUpdateInput
} from '../../types/linkPreview.types';
import { BaseRepository } from './base.repository.interface';
import { BasePagination } from '../../types/common.types';

export interface LinkPreviewRepository extends BaseRepository {
  /**
   * Récupère tous les aperçus de liens avec pagination, tri et filtrage
   */
  findAll(params: {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    search?: string;
  }): Promise<{
    data: LinkPreviewResponse[];
    pagination: BasePagination;
  }>;

  /**
   * Récupère un aperçu de lien par son ID
   */
  findById(id: string): Promise<LinkPreviewResponse | null>;

  /**
   * Récupère un aperçu de lien par son URL
   */
  findByUrl(url: string): Promise<LinkPreviewResponse | null>;

  /**
   * Crée un nouvel aperçu de lien
   */
  create(data: LinkPreviewCreateInput): Promise<LinkPreviewResponse>;

  /**
   * Met à jour un aperçu de lien existant
   */
  update(id: string, data: LinkPreviewUpdateInput): Promise<LinkPreviewResponse>;

  /**
   * Supprime un aperçu de lien
   */
  delete(id: string): Promise<void>;

  /**
   * Vérifie si un aperçu de lien existe avec l'URL donnée
   */
  existsByUrl(url: string): Promise<boolean>;

  /**
   * Met à jour ou crée un aperçu de lien (upsert)
   */
  upsert(url: string, data: LinkPreviewCreateInput): Promise<LinkPreviewResponse>;

  /**
   * Récupère les aperçus expirés (pour regénération)
   */
  findExpiredPreviews(expiredBefore: Date, limit?: number): Promise<LinkPreviewResponse[]>;
} 