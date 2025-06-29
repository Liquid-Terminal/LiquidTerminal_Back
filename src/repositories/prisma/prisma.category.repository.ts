import { CategoryRepository } from '../interfaces/category.repository.interface';
import { CategoryResponse, CategoryCreateInput, CategoryUpdateInput, CategoryWithProjects } from '../../types/project.types';
import { prisma } from '../../core/prisma.service';
import { logDeduplicator } from '../../utils/logDeduplicator';
import { PrismaClient } from '@prisma/client';

export class PrismaCategoryRepository implements CategoryRepository {
  private prismaClient: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'> = prisma;

  /**
   * Définit le client Prisma à utiliser pour les opérations de base de données
   * @param prismaClient Client Prisma à utiliser
   */
  setPrismaClient(prismaClient: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>): void {
    this.prismaClient = prismaClient;
    logDeduplicator.info('Prisma client updated in category repository');
  }

  /**
   * Réinitialise le client Prisma à sa valeur par défaut
   */
  resetPrismaClient(): void {
    this.prismaClient = prisma;
    logDeduplicator.info('Prisma client reset to default in category repository');
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    search?: string;
  }): Promise<{
    data: CategoryResponse[];
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
        search
      } = params;

      const skip = (page - 1) * limit;

      const where: any = {};
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ];
      }

      logDeduplicator.info('Finding all categories', { page, limit, sort, order, search });

      const total = await this.prismaClient.category.count({ where });
      const categories = await this.prismaClient.category.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort]: order }
      });

      logDeduplicator.info('Categories found successfully', { count: categories.length, total });

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
      logDeduplicator.error('Error finding all categories', { error, params });
      throw error;
    }
  }

  async findById(id: number): Promise<CategoryResponse | null> {
    try {
      logDeduplicator.info('Finding category by ID', { id });
      
      const category = await this.prismaClient.category.findUnique({
        where: { id }
      });

      if (category) {
        logDeduplicator.info('Category found successfully', { id });
      } else {
        logDeduplicator.info('Category not found', { id });
      }

      return category;
    } catch (error) {
      logDeduplicator.error('Error finding category by ID', { error, id });
      throw error;
    }
  }

  async findByIdWithProjects(id: number): Promise<CategoryWithProjects | null> {
    try {
      logDeduplicator.info('Finding category with projects by ID', { id });
      
      const category = await this.prismaClient.category.findUnique({
        where: { id },
        include: {
          projects: {
            select: {
              id: true,
              title: true,
              desc: true,
              logo: true
            }
          }
        }
      });

      if (category) {
        logDeduplicator.info('Category with projects found successfully', { id, projectsCount: category.projects.length });
      } else {
        logDeduplicator.info('Category with projects not found', { id });
      }

      return category;
    } catch (error) {
      logDeduplicator.error('Error finding category with projects by ID', { error, id });
      throw error;
    }
  }

  async create(data: CategoryCreateInput): Promise<CategoryResponse> {
    try {
      logDeduplicator.info('Creating category', { name: data.name });
      
      const category = await this.prismaClient.category.create({
        data
      });

      logDeduplicator.info('Category created successfully', { id: category.id, name: category.name });
      
      return category;
    } catch (error) {
      logDeduplicator.error('Error creating category', { error, data });
      throw error;
    }
  }

  async update(id: number, data: CategoryUpdateInput): Promise<CategoryResponse> {
    try {
      logDeduplicator.info('Updating category', { id });
      
      const category = await this.prismaClient.category.update({
        where: { id },
        data
      });

      logDeduplicator.info('Category updated successfully', { id });
      
      return category;
    } catch (error) {
      logDeduplicator.error('Error updating category', { error, id, data });
      throw error;
    }
  }

  async delete(id: number): Promise<void> {
    try {
      logDeduplicator.info('Deleting category', { id });
      
      await this.prismaClient.category.delete({
        where: { id }
      });

      logDeduplicator.info('Category deleted successfully', { id });
    } catch (error) {
      logDeduplicator.error('Error deleting category', { error, id });
      throw error;
    }
  }

  async existsByName(name: string): Promise<boolean> {
    try {
      logDeduplicator.info('Checking if category exists by name', { name });
      
      const category = await this.prismaClient.category.findUnique({
        where: { name }
      });
      
      const exists = !!category;
      
      logDeduplicator.info('Category existence check completed', { name, exists });
      
      return exists;
    } catch (error) {
      logDeduplicator.error('Error checking if category exists by name', { error, name });
      throw error;
    }
  }

  async getProjectsByCategory(categoryId: number): Promise<any[]> {
    try {
      logDeduplicator.info('Finding projects by category', { categoryId });
      
      const projects = await this.prismaClient.project.findMany({
        where: { categoryId },
        include: {
          category: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      logDeduplicator.info('Projects found by category successfully', { categoryId, count: projects.length });
      
      return projects;
    } catch (error) {
      logDeduplicator.error('Error finding projects by category', { error, categoryId });
      throw error;
    }
  }
} 