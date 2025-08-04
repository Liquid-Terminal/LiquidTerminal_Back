import { EducationalCategoryRepository } from '../interfaces/educational-category.repository.interface';
import { 
  EducationalCategoryResponse, 
  EducationalCategoryCreateInput, 
  EducationalCategoryUpdateInput
} from '../../types/educational.types';
import { prisma } from '../../core/prisma.service';
import { logDeduplicator } from '../../utils/logDeduplicator';

export class PrismaEducationalCategoryRepository implements EducationalCategoryRepository {
  private prismaClient: any = prisma;

  /**
   * Définit le client Prisma à utiliser pour les opérations de base de données
   * @param prismaClient Client Prisma à utiliser
   */
  setPrismaClient(prismaClient: any): void {
    this.prismaClient = prismaClient;
    logDeduplicator.info('Prisma client updated in educational category repository');
  }

  /**
   * Réinitialise le client Prisma à sa valeur par défaut
   */
  resetPrismaClient(): void {
    this.prismaClient = prisma;
    logDeduplicator.info('Prisma client reset to default in educational category repository');
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    search?: string;
    createdBy?: number;
  }): Promise<{
    data: EducationalCategoryResponse[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    try {
      const {
        page = 1,
        limit = 10,
        sort = 'createdAt',
        order = 'desc',
        search,
        createdBy
      } = params;

      const skip = (page - 1) * limit;

      const where: any = {};
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ];
      }
      if (createdBy) {
        where.createdBy = createdBy;
      }

      logDeduplicator.info('Finding all educational categories', { page, limit, sort, order, search, createdBy });

      const total = await this.prismaClient.educationalCategory.count({ where });
      const categories = await this.prismaClient.educationalCategory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort]: order },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      logDeduplicator.info('Educational categories found successfully', { count: categories.length, total });

      return {
        data: categories,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logDeduplicator.error('Error finding all educational categories', { error, params });
      throw error;
    }
  }

  async findById(id: number): Promise<EducationalCategoryResponse | null> {
    try {
      logDeduplicator.info('Finding educational category by ID', { id });
      
      const category = await this.prismaClient.educationalCategory.findUnique({
        where: { id },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      if (category) {
        logDeduplicator.info('Educational category found successfully', { id });
      } else {
        logDeduplicator.info('Educational category not found', { id });
      }

      return category;
    } catch (error) {
      logDeduplicator.error('Error finding educational category by ID', { error, id });
      throw error;
    }
  }



  async create(data: EducationalCategoryCreateInput): Promise<EducationalCategoryResponse> {
    try {
      logDeduplicator.info('Creating educational category', { name: data.name });
      
      const category = await this.prismaClient.educationalCategory.create({
        data,
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      logDeduplicator.info('Educational category created successfully', { id: category.id, name: category.name });
      
      return category;
    } catch (error) {
      logDeduplicator.error('Error creating educational category', { error, data });
      throw error;
    }
  }

  async update(id: number, data: EducationalCategoryUpdateInput): Promise<EducationalCategoryResponse> {
    try {
      logDeduplicator.info('Updating educational category', { id });
      
      const category = await this.prismaClient.educationalCategory.update({
        where: { id },
        data,
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      logDeduplicator.info('Educational category updated successfully', { id });
      
      return category;
    } catch (error) {
      logDeduplicator.error('Error updating educational category', { error, id, data });
      throw error;
    }
  }

  async delete(id: number): Promise<void> {
    try {
      logDeduplicator.info('Deleting educational category', { id });
      
      await this.prismaClient.educationalCategory.delete({
        where: { id }
      });

      logDeduplicator.info('Educational category deleted successfully', { id });
    } catch (error) {
      logDeduplicator.error('Error deleting educational category', { error, id });
      throw error;
    }
  }

  async existsByName(name: string): Promise<boolean> {
    try {
      logDeduplicator.info('Checking if educational category exists by name', { name });
      
      const category = await this.prismaClient.educationalCategory.findFirst({
        where: { 
          name: {
            equals: name,
            mode: 'insensitive'
          }
        }
      });
      
      const exists = !!category;
      
      logDeduplicator.info('Educational category existence check completed', { name, exists });
      
      return exists;
    } catch (error) {
      logDeduplicator.error('Error checking if educational category exists by name', { error, name });
      throw error;
    }
  }

  async getResourcesByCategory(categoryId: number): Promise<any[]> {
    try {
      logDeduplicator.info('Finding resources by educational category', { categoryId });
      
      const resourceCategories = await this.prismaClient.educationalResourceCategory.findMany({
        where: { categoryId },
        include: {
          resource: {
            include: {
              creator: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          }
        }
      });

      const resources = resourceCategories.map((rc: any) => rc.resource);

      logDeduplicator.info('Resources found by educational category successfully', { categoryId, count: resources.length });
      
      return resources;
    } catch (error) {
      logDeduplicator.error('Error finding resources by educational category', { error, categoryId });
      throw error;
    }
  }

  async findByCreator(userId: number): Promise<EducationalCategoryResponse[]> {
    try {
      logDeduplicator.info('Finding educational categories by creator', { userId });
      
      const categories = await this.prismaClient.educationalCategory.findMany({
        where: { createdBy: userId },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      logDeduplicator.info('Educational categories found by creator successfully', { userId, count: categories.length });
      
      return categories;
    } catch (error) {
      logDeduplicator.error('Error finding educational categories by creator', { error, userId });
      throw error;
    }
  }

  async findByName(name: string): Promise<EducationalCategoryResponse | null> {
    try {
      logDeduplicator.info('Finding educational category by name', { name });
      
      const category = await this.prismaClient.educationalCategory.findFirst({
        where: { 
          name: {
            equals: name,
            mode: 'insensitive'
          }
        },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      logDeduplicator.info('Educational category by name search completed', { name, found: !!category });
      
      return category;
    } catch (error) {
      logDeduplicator.error('Error finding educational category by name', { error, name });
      throw error;
    }
  }
} 