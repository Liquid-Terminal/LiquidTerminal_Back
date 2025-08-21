import { 
  WalletListItemResponse, 
  WalletListItemCreateInput, 
  WalletListItemUpdateInput
} from '../../types/walletlist.types';
import { BaseRepository } from './base.repository.interface';
import { BasePagination } from '../../types/common.types';

export interface WalletListItemRepository extends BaseRepository {
  /**
   * Récupère tous les items d'une wallet list avec pagination, tri et filtrage
   */
  findAll(params: {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    search?: string;
    walletListId?: number;
  }): Promise<{
    data: WalletListItemResponse[];
    pagination: BasePagination;
  }>;

  /**
   * Récupère un item de wallet list par son ID
   */
  findById(id: number): Promise<WalletListItemResponse | null>;

  /**
   * Crée un nouvel item de wallet list
   */
  create(data: WalletListItemCreateInput): Promise<WalletListItemResponse>;

  /**
   * Met à jour un item de wallet list existant
   */
  update(id: number, data: WalletListItemUpdateInput): Promise<WalletListItemResponse>;

  /**
   * Supprime un item de wallet list
   */
  delete(id: number): Promise<void>;

  /**
   * Récupère tous les items d'une wallet list spécifique
   */
  findByWalletList(walletListId: number, params?: {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
  }): Promise<{
    data: WalletListItemResponse[];
    pagination: BasePagination;
  }>;

  /**
   * Vérifie si un userWallet est déjà dans une wallet list
   */
  existsInWalletList(walletListId: number, userWalletId: number): Promise<boolean>;

  /**
   * Réorganise l'ordre des items dans une wallet list
   */
  reorderItems(walletListId: number, itemOrders: { id: number; order: number }[]): Promise<void>;

  /**
   * Récupère le prochain ordre disponible pour une wallet list
   */
  getNextOrder(walletListId: number): Promise<number>;

  /**
   * Supprime tous les items d'une wallet list
   */
  deleteByWalletList(walletListId: number): Promise<void>;

  /**
   * Compte le nombre d'items dans une wallet list
   */
  countByWalletList(walletListId: number): Promise<number>;

  /**
   * Met à jour l'ordre d'un item
   */
  updateOrder(id: number, order: number): Promise<WalletListItemResponse>;
}
