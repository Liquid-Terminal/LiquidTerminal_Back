import { BaseRepository } from './base.repository.interface';
import { User, UserRole } from '@prisma/client';

/**
 * Interface pour le repository utilisateur
 * Définit les méthodes pour gérer les utilisateurs
 */
export interface UserRepository extends BaseRepository {
  /**
   * Trouve un utilisateur par son ID
   * @param id ID de l'utilisateur
   */
  findById(id: number): Promise<User | null>;

  /**
   * Trouve un utilisateur par son Privy User ID
   * @param privyUserId Privy User ID
   */
  findByPrivyUserId(privyUserId: string): Promise<User | null>;

  /**
   * Trouve un utilisateur par son email
   * @param email Email de l'utilisateur
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Crée un nouvel utilisateur
   * @param data Données de l'utilisateur
   */
  create(data: {
    privyUserId: string;
    name: string;
    email?: string;
    role?: UserRole;
    verified?: boolean;
  }): Promise<User>;

  /**
   * Met à jour un utilisateur
   * @param id ID de l'utilisateur
   * @param data Données à mettre à jour
   */
  update(id: number, data: {
    name?: string;
    email?: string | null;
    role?: UserRole;
    verified?: boolean;
  }): Promise<User>;

  /**
   * Supprime un utilisateur
   * @param id ID de l'utilisateur
   */
  delete(id: number): Promise<User>;

  /**
   * Trouve ou crée un utilisateur (upsert)
   * @param privyUserId Privy User ID
   * @param data Données de l'utilisateur
   */
  findOrCreate(privyUserId: string, data: {
    name: string;
    email?: string;
    role?: UserRole;
    verified?: boolean;
  }): Promise<User>;

  /**
   * Liste les utilisateurs avec pagination et filtres
   * @param options Options de pagination et filtres
   */
  findMany(options: {
    skip?: number;
    take?: number;
    search?: string;
    verified?: boolean;
    orderBy?: { [key: string]: 'asc' | 'desc' };
  }): Promise<User[]>;

  /**
   * Compte le nombre d'utilisateurs avec filtres
   * @param search Terme de recherche
   * @param verified Statut de vérification
   */
  count(options: {
    search?: string;
    verified?: boolean;
  }): Promise<number>;

  /**
   * Vérifie si un utilisateur existe par Privy User ID
   * @param privyUserId Privy User ID
   */
  existsByPrivyUserId(privyUserId: string): Promise<boolean>;

  /**
   * Vérifie si un email existe déjà
   * @param email Email à vérifier
   * @param excludeUserId ID de l'utilisateur à exclure (pour les mises à jour)
   */
  existsByEmail(email: string, excludeUserId?: number): Promise<boolean>;
} 