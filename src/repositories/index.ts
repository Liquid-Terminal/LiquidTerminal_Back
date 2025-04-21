import { ProjectRepository } from './interfaces/project.repository.interface';
import { CategoryRepository } from './interfaces/category.repository.interface';
import { PrismaProjectRepository } from './impl/prisma.project.repository';
import { PrismaCategoryRepository } from './impl/prisma.category.repository';

// Export des interfaces
export type { ProjectRepository, CategoryRepository };

// Export des implémentations
export { PrismaProjectRepository, PrismaCategoryRepository };

// Instances par défaut
export const projectRepository: ProjectRepository = new PrismaProjectRepository();
export const categoryRepository: CategoryRepository = new PrismaCategoryRepository(); 