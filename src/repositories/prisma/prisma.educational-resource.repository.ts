import { EducationalResourceRepository } from '../interfaces/educational-resource.repository.interface';
import { 
  EducationalResourceResponse, 
  EducationalResourceCreateInput, 
  EducationalResourceUpdateInput,
  EducationalResourceCategoryCreateInput,
  EducationalResourceCategoryResponse 
} from '../../types/educational.types';
import { prisma } from '../../core/prisma.service';
import { logDeduplicator } from '../../utils/logDeduplicator';

export class PrismaEducationalResourceRepository implements EducationalResourceRepository {
  private prismaClient: any = prisma;

  // Helper pour les includes répétitifs
  private readonly includeConfig = {
    creator: {
      select: {
        id: true,
        name: true,
        email: true
      }
    },
    categories: {
      include: {
        category: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        assigner: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    }
  };

  setPrismaClient(prismaClient: any): void {
    this.prismaClient = prismaClient;
    logDeduplicator.info('Prisma client updated in educational resource repository');
  }

  resetPrismaClient(): void {
    this.prismaClient = prisma;
    logDeduplicator.info('Prisma client reset to default in educational resource repository');
  }

  // Helper pour try/catch avec logging
  private async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: any
  ): Promise<T> {
    try {
      if (context) {
        logDeduplicator.info(`Starting ${operationName}`, context);
      }
      const result = await operation();
      if (context) {
        logDeduplicator.info(`${operationName} completed successfully`, context);
      }
      return result;
    } catch (error) {
      logDeduplicator.error(`Error in ${operationName}`, { error, context });
      throw error;
    }
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    search?: string;
    addedBy?: number;
    categoryId?: number;
  }): Promise<{
    data: EducationalResourceResponse[];
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
        addedBy,
        categoryId
      } = params;

      const skip = (page - 1) * limit;

      const where: any = {};
      if (search) {
        where.url = { contains: search, mode: 'insensitive' };
      }
      if (addedBy) {
        where.addedBy = addedBy;
      }
      if (categoryId) {
        where.categories = {
          some: { categoryId }
        };
      }

      logDeduplicator.info('Finding all educational resources', { page, limit, sort, order, search, addedBy, categoryId });

      const total = await this.prismaClient.educationalResource.count({ where });
      const resources = await this.prismaClient.educationalResource.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort]: order },
        include: this.includeConfig
      });

      logDeduplicator.info('Educational resources found successfully', { count: resources.length, total });

      return {
        data: resources,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logDeduplicator.error('Error finding all educational resources', { error, params });
      throw error;
    }
  }

  async findById(id: number): Promise<EducationalResourceResponse | null> {
    try {
      logDeduplicator.info('Finding educational resource by ID', { id });
      
      const resource = await this.prismaClient.educationalResource.findUnique({
        where: { id },
        include: this.includeConfig
      });

      if (resource) {
        logDeduplicator.info('Educational resource found successfully', { id });
      } else {
        logDeduplicator.info('Educational resource not found', { id });
      }

      return resource;
    } catch (error) {
      logDeduplicator.error('Error finding educational resource by ID', { error, id });
      throw error;
    }
  }



  async create(data: EducationalResourceCreateInput): Promise<EducationalResourceResponse> {
    try {
      logDeduplicator.info('Creating educational resource', { url: data.url });
      
      const { categoryIds, ...resourceData } = data;
      
      const resource = await this.prismaClient.educationalResource.create({
        data: {
          ...resourceData,
          ...(categoryIds && categoryIds.length > 0 ? {
            categories: {
              create: categoryIds.map(categoryId => ({
                categoryId,
                assignedBy: data.addedBy
              }))
            }
          } : {})
        },
        include: this.includeConfig
      });

      logDeduplicator.info('Educational resource created successfully', { id: resource.id, url: resource.url });
      
      return resource;
    } catch (error) {
      logDeduplicator.error('Error creating educational resource', { error, data });
      throw error;
    }
  }

  async update(id: number, data: EducationalResourceUpdateInput): Promise<EducationalResourceResponse> {
    try {
      logDeduplicator.info('Updating educational resource', { id });
      
      const resource = await this.prismaClient.educationalResource.update({
        where: { id },
        data,
        include: this.includeConfig
      });

      logDeduplicator.info('Educational resource updated successfully', { id });
      
      return resource;
    } catch (error) {
      logDeduplicator.error('Error updating educational resource', { error, id, data });
      throw error;
    }
  }

  async delete(id: number): Promise<void> {
    return this.executeWithErrorHandling(
      async () => {
        await this.prismaClient.educationalResource.delete({
          where: { id }
        });
      },
      'deleting educational resource',
      { id }
    );
  }

  async existsByUrl(url: string): Promise<boolean> {
    return this.executeWithErrorHandling(
      async () => {
        const resource = await this.prismaClient.educationalResource.findFirst({
          where: { url }
        });
        return !!resource;
      },
      'checking if educational resource exists by URL',
      { url }
    );
  }

  async findByCreator(userId: number): Promise<EducationalResourceResponse[]> {
    try {
      logDeduplicator.info('Finding educational resources by creator', { userId });
      
      const resources = await this.prismaClient.educationalResource.findMany({
        where: { addedBy: userId },
        include: this.includeConfig,
        orderBy: { createdAt: 'desc' }
      });

      logDeduplicator.info('Educational resources found by creator successfully', { userId, count: resources.length });
      
      return resources;
    } catch (error) {
      logDeduplicator.error('Error finding educational resources by creator', { error, userId });
      throw error;
    }
  }

  async findByCategory(categoryId: number): Promise<EducationalResourceResponse[]> {
    try {
      logDeduplicator.info('Finding educational resources by category', { categoryId });
      
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
              },
              categories: {
                include: {
                  category: {
                    select: {
                      id: true,
                      name: true,
                      description: true
                    }
                  },
                  assigner: {
                    select: {
                      id: true,
                      name: true,
                      email: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      const resources = resourceCategories.map((rc: any) => rc.resource);

      logDeduplicator.info('Educational resources found by category successfully', { categoryId, count: resources.length });
      
      return resources;
    } catch (error) {
      logDeduplicator.error('Error finding educational resources by category', { error, categoryId });
      throw error;
    }
  }

  async assignToCategory(data: EducationalResourceCategoryCreateInput): Promise<EducationalResourceCategoryResponse> {
    try {
      logDeduplicator.info('Assigning resource to category', data);
      
      const assignment = await this.prismaClient.educationalResourceCategory.create({
        data,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              description: true
            }
          },
          assigner: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      logDeduplicator.info('Resource assigned to category successfully', { 
        resourceId: data.resourceId, 
        categoryId: data.categoryId 
      });
      
      return assignment;
    } catch (error) {
      logDeduplicator.error('Error assigning resource to category', { error, data });
      throw error;
    }
  }

  async removeFromCategory(resourceId: number, categoryId: number): Promise<void> {
    try {
      logDeduplicator.info('Removing resource from category', { resourceId, categoryId });
      
      await this.prismaClient.educationalResourceCategory.deleteMany({
        where: {
          resourceId,
          categoryId
        }
      });

      logDeduplicator.info('Resource removed from category successfully', { resourceId, categoryId });
    } catch (error) {
      logDeduplicator.error('Error removing resource from category', { error, resourceId, categoryId });
      throw error;
    }
  }

  async isAssignedToCategory(resourceId: number, categoryId: number): Promise<boolean> {
    try {
      logDeduplicator.info('Checking if resource is assigned to category', { resourceId, categoryId });
      
      const assignment = await this.prismaClient.educationalResourceCategory.findFirst({
        where: {
          resourceId,
          categoryId
        }
      });
      
      const exists = !!assignment;
      
      logDeduplicator.info('Resource category assignment check completed', { resourceId, categoryId, exists });
      
      return exists;
    } catch (error) {
      logDeduplicator.error('Error checking resource category assignment', { error, resourceId, categoryId });
      throw error;
    }
  }

  async getResourceAssignments(resourceId: number): Promise<EducationalResourceCategoryResponse[]> {
    try {
      logDeduplicator.info('Getting resource assignments', { resourceId });
      
      const assignments = await this.prismaClient.educationalResourceCategory.findMany({
        where: { resourceId },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              description: true
            }
          },
          assigner: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      logDeduplicator.info('Resource assignments retrieved successfully', { resourceId, count: assignments.length });
      
      return assignments;
    } catch (error) {
      logDeduplicator.error('Error getting resource assignments', { error, resourceId });
      throw error;
    }
  }
} 