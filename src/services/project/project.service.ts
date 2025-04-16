import { PrismaClient } from '@prisma/client';
import { ProjectCreateInput, ProjectUpdateInput } from '../../types/project.types';
import { logger } from '../../utils/logger';
import { 
  ProjectNotFoundError, 
  ProjectAlreadyExistsError,
  CategoryNotFoundError 
} from '../../errors/project.errors';
import { logDeduplicator } from '../../utils/logDeduplicator';

export class ProjectService {
  private prisma: PrismaClient;
  
  constructor() {
    this.prisma = new PrismaClient();
  }

  public async createProject(projectData: ProjectCreateInput) {
    try {
      const existingProject = await this.prisma.project.findUnique({
        where: { title: projectData.title }
      });

      if (existingProject) {
        throw new ProjectAlreadyExistsError();
      }

      const project = await this.prisma.project.create({
        data: projectData
      });

      logDeduplicator.info('Project created successfully', { projectId: project.id });
      return project;
    } catch (error) {
      if (error instanceof ProjectAlreadyExistsError) {
        throw error;
      }
      logger.error('Error creating project:', { error, projectData });
      throw error;
    }
  }

  async getAllProjects(query: {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    search?: string;
    categoryId?: number;
  } = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sort = 'createdAt',
        order = 'desc',
        search,
        categoryId
      } = query;

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

      const total = await this.prisma.project.count({ where });
      const projects = await this.prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort]: order },
        include: {
          category: true
        }
      });

      logDeduplicator.info('Projects retrieved successfully', { 
        count: projects.length,
        page,
        limit,
        total
      });

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
      logger.error('Error fetching projects:', { error, query });
      throw error;
    }
  }

  public async getProjectById(id: number) {
    try {
      const project = await this.prisma.project.findUnique({
        where: { id },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              description: true
            }
          }
        }
      });

      if (!project) {
        throw new ProjectNotFoundError();
      }

      logDeduplicator.info('Project retrieved successfully', { projectId: id });
      return project;
    } catch (error) {
      if (error instanceof ProjectNotFoundError) {
        throw error;
      }
      logger.error('Error fetching project:', { error, projectId: id });
      throw error;
    }
  }

  public async updateProject(id: number, projectData: ProjectUpdateInput) {
    try {
      const project = await this.prisma.project.findUnique({
        where: { id }
      });

      if (!project) {
        throw new ProjectNotFoundError();
      }

      const updatedProject = await this.prisma.project.update({
        where: { id },
        data: projectData,
        include: {
          category: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      logDeduplicator.info('Project updated successfully', { projectId: id });
      return updatedProject;
    } catch (error) {
      if (error instanceof ProjectNotFoundError) {
        throw error;
      }
      logger.error('Error updating project:', { error, projectId: id, projectData });
      throw error;
    }
  }

  public async deleteProject(id: number) {
    try {
      const project = await this.prisma.project.findUnique({
        where: { id }
      });

      if (!project) {
        throw new ProjectNotFoundError();
      }

      await this.prisma.project.delete({
        where: { id }
      });

      logDeduplicator.info('Project deleted successfully', { projectId: id });
    } catch (error) {
      if (error instanceof ProjectNotFoundError) {
        throw error;
      }
      logger.error('Error deleting project:', { error, projectId: id });
      throw error;
    }
  }

  /**
   * Met à jour la catégorie d'un projet
   */
  public async updateProjectCategory(projectId: number, categoryId: number | null) {
    try {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId }
      });

      if (!project) {
        throw new ProjectNotFoundError();
      }

      // Si categoryId n'est pas null, vérifier que la catégorie existe
      if (categoryId !== null) {
        const category = await this.prisma.category.findUnique({
          where: { id: categoryId }
        });

        if (!category) {
          throw new CategoryNotFoundError();
        }
      }

      const updatedProject = await this.prisma.project.update({
        where: { id: projectId },
        data: { categoryId },
        include: {
          category: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      logDeduplicator.info('Project category updated successfully', { 
        projectId,
        categoryId
      });
      
      return updatedProject;
    } catch (error) {
      if (error instanceof ProjectNotFoundError || error instanceof CategoryNotFoundError) {
        throw error;
      }
      logger.error('Error updating project category:', { error, projectId, categoryId });
      throw error;
    }
  }

  /**
   * Récupère tous les projets d'une catégorie
   */
  public async getProjectsByCategory(categoryId: number) {
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