export interface Project {
  id: number;
  title: string;
  desc: string;
  logo: string;
  twitter?: string;
  discord?: string;
  telegram?: string;
  website?: string;
  createdAt: Date;
  updatedAt: Date;
  categoryId?: number;
  category?: {
    id: number;
    name: string;
  } | null;
}

export interface CreateProjectDto {
  title: string;
  desc: string;
  logo: string;
  twitter?: string;
  discord?: string;
  telegram?: string;
  website?: string;
  categoryId?: number;
}

export interface ProjectWithCategory extends Omit<Project, 'category'> {
  category: {
    id: number;
    name: string;
    description: string | null;
  } | null;
} 