import { PrismaClient } from '@prisma/client';
import { ProjectRepository } from '../interfaces/project.repository.interface';
import { Project, ProjectCreateInput, ProjectUpdateInput } from '../../types/project.types';
import { BasePagination } from '../../types/common.types';
import { prisma } from '../../core/prisma.service';
import { logDeduplicator } from '../../utils/logDeduplicator';

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
    categoryIds?: number[];
  }): Promise<{
    data: Project[];
    pagination: BasePagination;
  }> {
    try {
      const {
        page = 1,
        limit = 10,
        sort = 'createdAt',
        order = 'desc',
        search,
        categoryIds
      } = params;

      const skip = (page - 1) * limit;

      const where: any = {};
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { desc: { contains: search, mode: 'insensitive' } }
        ];
      }
      if (categoryIds && categoryIds.length > 0) {
        where.categories = {
          some: {
            categoryId: {
              in: categoryIds
            }
          }
        };
      }

      logDeduplicator.info('Finding all projects', { page, limit, sort, order, search, categoryIds });

      const total = await this.prismaClient.project.count({ where });
      const projects = await (this.prismaClient as any).project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort]: order },
        include: {
          categories: {
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
          }
        }
      });

      // Transformer les données pour correspondre au type Project
      const transformedProjects = projects.map((project: any) => ({
        ...project,
        categories: project.categories.map((pc: any) => pc.category)
      }));

      logDeduplicator.info('Projects found successfully', { count: transformedProjects.length, total });

      const totalPages = Math.ceil(total / limit);
      return {
        data: transformedProjects,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrevious: page > 1
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
      
      const project = await (this.prismaClient as any).project.findUnique({
        where: { id },
        include: {
          categories: {
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
          }
        }
      });

      if (!project) {
        logDeduplicator.info('Project not found', { id });
        return null;
      }

      // Transformer les données pour correspondre au type Project
      const transformedProject = {
        ...project,
        categories: (project as any).categories.map((pc: any) => pc.category)
      };

      logDeduplicator.info('Project found successfully', { id, title: project.title });
      
      return transformedProject;
    } catch (error) {
      logDeduplicator.error('Error finding project by ID', { error, id });
      throw error;
    }
  }

  async create(data: ProjectCreateInput): Promise<Project> {
    try {
      logDeduplicator.info('Creating project', { title: data.title });
      
      if (!data.logo) {
        throw new Error('Logo is required for project creation');
      }

      const { categoryIds, ...projectData } = data;

      const project = await (this.prismaClient as any).project.create({
        data: {
          ...projectData,
          logo: projectData.logo || '',
          twitter: projectData.twitter || null,
          discord: projectData.discord || null,
          telegram: projectData.telegram || null,
          website: projectData.website || null,
          ...(categoryIds && categoryIds.length > 0 ? {
            categories: {
              create: categoryIds.map(categoryId => ({
                categoryId
              }))
            }
          } : {})
        },
        include: {
          categories: {
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
          }
        }
      });

      // Transformer les données pour correspondre au type Project
      const transformedProject = {
        ...project,
        categories: (project as any).categories.map((pc: any) => pc.category)
      };

      logDeduplicator.info('Project created successfully', { id: project.id, title: project.title });
      
      return transformedProject;
    } catch (error) {
      logDeduplicator.error('Error creating project', { error, data });
      throw error;
    }
  }

  async update(id: number, data: ProjectUpdateInput): Promise<Project> {
    try {
      logDeduplicator.info('Updating project', { id, data });
      
      const { categoryIds, ...projectData } = data;

      const project = await (this.prismaClient as any).project.update({
        where: { id },
        data: {
          ...projectData,
          ...(categoryIds !== undefined ? {
            categories: {
              deleteMany: {},
              ...(categoryIds.length > 0 ? {
                create: categoryIds.map(categoryId => ({
                  categoryId
                }))
              } : {})
            }
          } : {})
        },
        include: {
          categories: {
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
          }
        }
      });

      // Transformer les données pour correspondre au type Project
      const transformedProject = {
        ...project,
        categories: (project as any).categories.map((pc: any) => pc.category)
      };

      logDeduplicator.info('Project updated successfully', { id, title: project.title });
      
      return transformedProject;
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
      
      const count = await this.prismaClient.project.count({
        where: { title }
      });

      const exists = count > 0;
      logDeduplicator.info('Project exists check completed', { title, exists });
      
      return exists;
    } catch (error) {
      logDeduplicator.error('Error checking if project exists by title', { error, title });
      throw error;
    }
  }

  async assignCategories(projectId: number, categoryIds: number[]): Promise<void> {
    try {
      logDeduplicator.info('Assigning categories to project', { projectId, categoryIds });
      
      await (this.prismaClient as any).projectCategory.createMany({
        data: categoryIds.map(categoryId => ({
          projectId,
          categoryId
        })),
        skipDuplicates: true
      });

      logDeduplicator.info('Categories assigned to project successfully', { projectId, categoryIds });
    } catch (error) {
      logDeduplicator.error('Error assigning categories to project', { error, projectId, categoryIds });
      throw error;
    }
  }

  async removeCategories(projectId: number, categoryIds: number[]): Promise<void> {
    try {
      logDeduplicator.info('Removing categories from project', { projectId, categoryIds });
      
      await (this.prismaClient as any).projectCategory.deleteMany({
        where: {
          projectId,
          categoryId: {
            in: categoryIds
          }
        }
      });

      logDeduplicator.info('Categories removed from project successfully', { projectId, categoryIds });
    } catch (error) {
      logDeduplicator.error('Error removing categories from project', { error, projectId, categoryIds });
      throw error;
    }
  }

  async getProjectCategories(projectId: number): Promise<any[]> {
    try {
      logDeduplicator.info('Getting project categories', { projectId });
      
      const projectCategories = await (this.prismaClient as any).projectCategory.findMany({
        where: { projectId },
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

      const categories = projectCategories.map((pc: any) => pc.category);

      logDeduplicator.info('Project categories retrieved successfully', { projectId, count: categories.length });
      
      return categories;
    } catch (error) {
      logDeduplicator.error('Error getting project categories', { error, projectId });
      throw error;
    }
  }
} 