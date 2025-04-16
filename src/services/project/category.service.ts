import { PrismaClient } from '@prisma/client';
import { CategoryCreateInput, CategoryUpdateInput } from '../../types/project.types';
import { logger } from '../../utils/logger';
import { CategoryNotFoundError, CategoryAlreadyExistsError } from '../../errors/project.errors';
import { logDeduplicator } from '../../utils/logDeduplicator';

export class CategoryService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Récupère toutes les catégories
   */
  async getAllCategories(query: {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    search?: string;
  } = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sort = 'createdAt',
        order = 'desc',
        search
      } = query;

      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ];
      }

      // Get total count for pagination
      const total = await this.prisma.category.count({ where });

      // Get paginated results
      const categories = await this.prisma.category.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort]: order }
      });

      logDeduplicator.info('Categories retrieved successfully', { 
        count: categories.length,
        page,
        limit,
        total
      });

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
      logger.error('Error fetching categories:', { error, query });
      throw error;
    }
  }

  /**
   * Récupère une catégorie par son ID
   */
  async getCategoryById(id: number) {
    try {
      const category = await this.prisma.category.findUnique({
        where: { id }
      });

      if (!category) {
        throw new CategoryNotFoundError();
      }

      logDeduplicator.info('Category retrieved successfully', { categoryId: id });
      return category;
    } catch (error) {
      if (error instanceof CategoryNotFoundError) {
        throw error;
      }
      logger.error('Error fetching category:', { error, categoryId: id });
      throw error;
    }
  }

  /**
   * Récupère une catégorie avec ses projets
   */
  async getCategoryWithProjects(id: number) {
    try {
      const category = await this.prisma.category.findUnique({
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

      if (!category) {
        throw new CategoryNotFoundError();
      }

      logDeduplicator.info('Category with projects retrieved successfully', { 
        categoryId: id,
        projectsCount: category.projects.length
      });

      return category;
    } catch (error) {
      if (error instanceof CategoryNotFoundError) {
        throw error;
      }
      logger.error('Error fetching category with projects:', { error, categoryId: id });
      throw error;
    }
  }

  /**
   * Crée une nouvelle catégorie
   */
  async createCategory(data: CategoryCreateInput) {
    try {
      const existingCategory = await this.prisma.category.findUnique({
        where: { name: data.name }
      });

      if (existingCategory) {
        throw new CategoryAlreadyExistsError();
      }

      const category = await this.prisma.category.create({
        data
      });

      logDeduplicator.info('Category created successfully', { categoryId: category.id });
      return category;
    } catch (error) {
      if (error instanceof CategoryAlreadyExistsError) {
        throw error;
      }
      logger.error('Error creating category:', { error, data });
      throw error;
    }
  }

  /**
   * Met à jour une catégorie existante
   */
  async updateCategory(id: number, data: CategoryUpdateInput) {
    try {
      const category = await this.prisma.category.findUnique({
        where: { id }
      });

      if (!category) {
        throw new CategoryNotFoundError();
      }

      if (data.name && data.name !== category.name) {
        const existingCategory = await this.prisma.category.findUnique({
          where: { name: data.name }
        });

        if (existingCategory) {
          throw new CategoryAlreadyExistsError();
        }
      }

      const updatedCategory = await this.prisma.category.update({
        where: { id },
        data
      });

      logDeduplicator.info('Category updated successfully', { categoryId: id });
      return updatedCategory;
    } catch (error) {
      if (error instanceof CategoryNotFoundError || error instanceof CategoryAlreadyExistsError) {
        throw error;
      }
      logger.error('Error updating category:', { error, categoryId: id, data });
      throw error;
    }
  }

  /**
   * Supprime une catégorie
   */
  async deleteCategory(id: number) {
    try {
      const category = await this.prisma.category.findUnique({
        where: { id }
      });

      if (!category) {
        throw new CategoryNotFoundError();
      }

      await this.prisma.category.delete({
        where: { id }
      });

      logDeduplicator.info('Category deleted successfully', { categoryId: id });
    } catch (error) {
      if (error instanceof CategoryNotFoundError) {
        throw error;
      }
      logger.error('Error deleting category:', { error, categoryId: id });
      throw error;
    }
  }

  /**
   * Récupère tous les projets d'une catégorie
   */
  async getProjectsByCategory(categoryId: number) {
    try {
      const category = await this.prisma.category.findUnique({
        where: { id: categoryId }
      });

      if (!category) {
        throw new CategoryNotFoundError();
      }

      const projects = await this.prisma.project.findMany({
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

      logDeduplicator.info('Projects by category retrieved successfully', { 
        categoryId,
        count: projects.length
      });
      
      return projects;
    } catch (error) {
      if (error instanceof CategoryNotFoundError) {
        throw error;
      }
      logger.error('Error fetching projects by category:', { error, categoryId });
      throw error;
    }
  }
} 