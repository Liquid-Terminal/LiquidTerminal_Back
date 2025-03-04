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