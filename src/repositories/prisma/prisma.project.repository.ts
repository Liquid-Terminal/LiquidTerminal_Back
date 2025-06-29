import { ProjectRepository } from '../interfaces/project.repository.interface';
import { Project, ProjectCreateInput, ProjectUpdateInput } from '../../types/project.types';
import { prisma } from '../../core/prisma.service';
import { logDeduplicator } from '../../utils/logDeduplicator';
import { PrismaClient } from '@prisma/client';

export class PrismaProjectRepository implements ProjectRepository {
  private prismaClient: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'> = prisma;

  /**
   * Définit le client Prisma à utiliser pour les opérations de base de données
   * @param prismaClient Client Prisma à utiliser
   */
  setPrismaClient(prismaClient: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>): void {
    this.prismaClient = prismaClient;
    logDeduplicator.info('Prisma client updated in project repository');
  }

  /**
   * Réinitialise le client Prisma à sa valeur par défaut
   */
  resetPrismaClient(): void {
    this.prismaClient = prisma;
    logDeduplicator.info('Prisma client reset to default in project repository');
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    search?: string;
    categoryId?: number;
  }): Promise<{
    data: Project[];
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
        categoryId
      } = params;

      const skip = (page - 1) * limit;

      const where: any = {};
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { desc: { contains: search, mode: 'insensitive' } }
        ];
      }
      if (categoryId) {
        where.categoryId = categoryId;
      }

      logDeduplicator.info('Finding all projects', { page, limit, sort, order, search, categoryId });

      const total = await this.prismaClient.project.count({ where });
      const projects = await this.prismaClient.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort]: order },
        include: {
          category: true
        }
      });

      logDeduplicator.info('Projects found successfully', { count: projects.length, total });

      return {
        data: projects,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logDeduplicator.error('Error finding all projects', { error, params });
      throw error;
    }
  }

  async findById(id: number): Promise<Project | null> {
    try {
      logDeduplicator.info('Finding project by ID', { id });
      
      const project = await this.prismaClient.project.findUnique({
        where: { id },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              description: true,
              createdAt: true,
              updatedAt: true
            }
          }
        }
      });

      if (project) {
        logDeduplicator.info('Project found successfully', { id });
      } else {
        logDeduplicator.info('Project not found', { id });
      }

      return project;
    } catch (error) {
      logDeduplicator.error('Error finding project by ID', { error, id });
      throw error;
    }
  }

  async create(data: ProjectCreateInput): Promise<Project> {
    try {
      logDeduplicator.info('Creating project', { title: data.title });
      
      const project = await this.prismaClient.project.create({
        data
      });

      logDeduplicator.info('Project created successfully', { id: project.id, title: project.title });
      
      return project;
    } catch (error) {
      logDeduplicator.error('Error creating project', { error, data });
      throw error;
    }
  }

  async update(id: number, data: ProjectUpdateInput): Promise<Project> {
    try {
      logDeduplicator.info('Updating project', { id });
      
      const project = await this.prismaClient.project.update({
        where: { id },
        data,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              description: true,
              createdAt: true,
              updatedAt: true
            }
          }
        }
      });

      logDeduplicator.info('Project updated successfully', { id });
      
      return project;
    } catch (error) {
      logDeduplicator.error('Error updating project', { error, id, data });
      throw error;
    }
  }

  async delete(id: number): Promise<void> {
    try {
      logDeduplicator.info('Deleting project', { id });
      
      await this.prismaClient.project.delete({
        where: { id }
      });

      logDeduplicator.info('Project deleted successfully', { id });
    } catch (error) {
      logDeduplicator.error('Error deleting project', { error, id });
      throw error;
    }
  }

  async existsByTitle(title: string): Promise<boolean> {
    try {
      logDeduplicator.info('Checking if project exists by title', { title });
      
      const project = await this.prismaClient.project.findUnique({
        where: { title }
      });
      
      const exists = !!project;
      
      logDeduplicator.info('Project existence check completed', { title, exists });
      
      return exists;
    } catch (error) {
      logDeduplicator.error('Error checking if project exists by title', { error, title });
      throw error;
    }
  }

  async updateCategory(projectId: number, categoryId: number | null): Promise<Project> {
    try {
      logDeduplicator.info('Updating project category', { projectId, categoryId });
      
      const project = await this.prismaClient.project.update({
        where: { id: projectId },
        data: { categoryId },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              description: true,
              createdAt: true,
              updatedAt: true
            }
          }
        }
      });

      logDeduplicator.info('Project category updated successfully', { projectId, categoryId });
      
      return project;
    } catch (error) {
      logDeduplicator.error('Error updating project category', { error, projectId, categoryId });
      throw error;
    }
  }

  async findByCategory(categoryId: number): Promise<Project[]> {
    try {
      logDeduplicator.info('Finding projects by category', { categoryId });
      
      const projects = await this.prismaClient.project.findMany({
        where: { categoryId },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              description: true,
              createdAt: true,
              updatedAt: true
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