import { BaseResponse, SocialLinks } from './common.types';

// Types de base pour les projets
export interface Project {
  id: number;
  title: string;
  desc: string;
  logo: string;
  twitter: string | null;
  discord: string | null;
  telegram: string | null;
  website: string | null;
  categoryId: number | null;
  createdAt: Date;
  updatedAt: Date;
  category?: CategoryResponse | null;
}

// Types pour les opérations CRUD des projets
export interface ProjectCreateInput {
  title: string;
  desc: string;
  logo?: string; // Rendu optionnel pour supporter les uploads
  twitter?: string;
  discord?: string;
  telegram?: string;
  website?: string;
  categoryId?: number;
}

// Type pour la création avec upload de fichier
export interface ProjectCreateWithUploadInput {
  title: string;
  desc: string;
  logo?: string; // URL optionnelle si pas de fichier uploadé
  twitter?: string;
  discord?: string;
  telegram?: string;
  website?: string;
  categoryId?: number;
}

export interface ProjectUpdateInput extends Partial<ProjectCreateInput> {}

// Types de réponse pour les projets
export interface ProjectResponse extends BaseResponse {
  data: Project;
}

export interface ProjectsResponse extends BaseResponse {
  data: Project[];
}

// Types de base pour les catégories
export interface CategoryResponse {
  id: number;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Types pour les opérations CRUD des catégories
export interface CategoryCreateInput {
  name: string;
  description?: string;
}

export interface CategoryUpdateInput {
  name?: string;
  description?: string;
}

// Types de réponse pour les catégories
export interface CategoryResponseWrapper extends BaseResponse {
  data: CategoryResponse;
}

export interface CategoriesResponseWrapper extends BaseResponse {
  data: CategoryResponse[];
}

// Type pour les catégories avec leurs projets associés
export interface CategoryWithProjects extends CategoryResponse {
  projects: {
    id: number;
    title: string;
    desc: string;
    logo: string;
  }[];
}

export interface CreateProjectDto {
  title: string;
  desc: string;
  logo: string;
  socialLinks?: SocialLinks;
} 