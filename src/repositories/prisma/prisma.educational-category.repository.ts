import { EducationalCategoryRepository } from '../interfaces/educational-category.repository.interface';
import { 
  EducationalCategoryResponse, 
  EducationalCategoryCreateInput, 
  EducationalCategoryUpdateInput
} from '../../types/educational.types';
import { BasePagination } from '../../types/common.types';
import { BasePrismaRepository } from './base-prisma.repository';

export class PrismaEducationalCategoryRepository extends BasePrismaRepository implements EducationalCategoryRepository {
  // Helper pour les includes répétitifs
  private readonly includeConfig = {
    creator: {
      select: BasePrismaRepository.UserSelect
    }
  };

  async findAll(params: {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    search?: string;
    createdBy?: number;
  }): Promise<{
    data: EducationalCategoryResponse[];
    pagination: BasePagination;
  }> {
    return this.executeWithErrorHandling(async () => {
      const {
        page = 1,
        limit = 10,
        sort = 'createdAt',
        order = 'desc',
        search,
        createdBy
      } = params;

      this.validatePaginationParams({ page, limit, sort, order });
      
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
      
      const { skip, take, orderBy } = this.buildQueryParams({ page, limit, sort, order });

      const total = await this.prismaClient.educationalCategory.count({ where });
      const categories = await this.prismaClient.educationalCategory.findMany({
        where,
        skip,
        take,
        orderBy,
        include: this.includeConfig
      });

      return {
        data: categories,
        pagination: this.buildPagination(total, page, limit)
      };
    }, 'finding all educational categories', { page: params.page, limit: params.limit, sort: params.sort, order: params.order, search: params.search, createdBy: params.createdBy });
  }

  async findById(id: number): Promise<EducationalCategoryResponse | null> {
    return this.executeWithErrorHandling(
      async () => {
        return await this.prismaClient.educationalCategory.findUnique({
          where: { id },
          include: this.includeConfig
        });
      },
      'finding educational category by ID',
      { id }
    );
  }

  async create(data: EducationalCategoryCreateInput): Promise<EducationalCategoryResponse> {
    return this.executeWithErrorHandling(
      async () => {
        return await this.prismaClient.educationalCategory.create({
          data: {
            name: data.name,
            description: data.description,
            creator: {
              connect: { id: data.createdBy }
            }
          },
          include: this.includeConfig
        });
      },
      'creating educational category',
      { name: data.name, createdBy: data.createdBy }
    );
  }

  async update(id: number, data: EducationalCategoryUpdateInput): Promise<EducationalCategoryResponse> {
    return this.executeWithErrorHandling(
      async () => {
        return await this.prismaClient.educationalCategory.update({
          where: { id },
          data,
          include: this.includeConfig
        });
      },
      'updating educational category',
      { id, ...data }
    );
  }

  async delete(id: number): Promise<void> {
    return this.executeWithErrorHandling(
      async () => {
        await this.prismaClient.educationalCategory.delete({
          where: { id }
        });
      },
      'deleting educational category',
      { id }
    );
  }

  async existsByName(name: string): Promise<boolean> {
    return this.executeWithErrorHandling(
      async () => {
        const category = await this.prismaClient.educationalCategory.findFirst({
          where: { name }
        });
        return !!category;
      },
      'checking if educational category exists by name',
      { name }
    );
  }

  async findByCreator(createdBy: number): Promise<EducationalCategoryResponse[]> {
    return this.executeWithErrorHandling(
      async () => {
        return await this.prismaClient.educationalCategory.findMany({
          where: { createdBy },
          include: this.includeConfig,
          orderBy: { createdAt: 'desc' }
        });
      },
      'finding educational categories by creator',
      { createdBy }
    );
  }

  async findByName(name: string): Promise<EducationalCategoryResponse | null> {
    return this.executeWithErrorHandling(
      async () => {
        return await this.prismaClient.educationalCategory.findFirst({
          where: { name },
          include: this.includeConfig
        });
      },
      'finding educational category by name',
      { name }
    );
  }

  async getResourcesByCategory(categoryId: number): Promise<any[]> {
    return this.executeWithErrorHandling(
      async () => {
        const resourceCategories = await this.prismaClient.educationalResourceCategory.findMany({
          where: { categoryId },
          include: {
            resource: {
              include: {
                creator: {
                  select: BasePrismaRepository.UserSelect
                }
              }
            }
          }
        });

        return resourceCategories.map((rc: any) => rc.resource);
      },
      'finding resources by educational category',
      { categoryId }
    );
  }
} 