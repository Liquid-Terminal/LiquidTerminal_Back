import { ProjectRepository } from './interfaces/project.repository.interface';
import { CategoryRepository } from './interfaces/category.repository.interface';
import { EducationalCategoryRepository } from './interfaces/educational-category.repository.interface';
import { EducationalResourceRepository } from './interfaces/educational-resource.repository.interface';
import { PrismaProjectRepository } from './prisma/prisma.project.repository';
import { PrismaCategoryRepository } from './prisma/prisma.category.repository';
import { PrismaEducationalCategoryRepository } from './prisma/prisma.educational-category.repository';
import { PrismaEducationalResourceRepository } from './prisma/prisma.educational-resource.repository';

// Export des interfaces
export type { 
  ProjectRepository, 
  CategoryRepository, 
  EducationalCategoryRepository, 
  EducationalResourceRepository 
};

// Export des implémentations
export { 
  PrismaProjectRepository, 
  PrismaCategoryRepository, 
  PrismaEducationalCategoryRepository,
  PrismaEducationalResourceRepository 
};

// Instances par défaut
export const projectRepository: ProjectRepository = new PrismaProjectRepository();
export const categoryRepository: CategoryRepository = new PrismaCategoryRepository();
export const educationalCategoryRepository: EducationalCategoryRepository = new PrismaEducationalCategoryRepository();
export const educationalResourceRepository: EducationalResourceRepository = new PrismaEducationalResourceRepository(); 