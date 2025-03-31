import { BaseResponse, SocialLinks } from './common.types';

export interface Project {
  id: number;
  title: string;
  desc: string;
  logo: string;
  socialLinks?: SocialLinks;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectDto {
  title: string;
  desc: string;
  logo: string;
  socialLinks?: SocialLinks;
}

export interface ProjectResponse extends BaseResponse {
  data: Project;
}

export interface ProjectsResponse extends BaseResponse {
  data: Project[];
}

// Types pour les catégories
export interface CategoryCreateInput {
  name: string;
  description?: string;
}

export interface CategoryUpdateInput {
  name?: string;
  description?: string;
}

export interface CategoryResponse {
  id: number;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryWithProjects extends CategoryResponse {
  projects: {
    id: number;
    title: string;
    desc: string;
    logo: string;
  }[];
}

export interface CategoryResponseWrapper extends BaseResponse {
  data: CategoryResponse;
}

export interface CategoriesResponseWrapper extends BaseResponse {
  data: CategoryResponse[];
} 