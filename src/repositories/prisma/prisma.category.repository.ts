import { CategoryRepository } from '../interfaces/category.repository.interface';
import { CategoryResponse, CategoryCreateInput, CategoryUpdateInput, CategoryWithProjects } from '../../types/project.types';
import { BasePagination } from '../../types/common.types';
import { BasePrismaRepository } from './base-prisma.repository';

export class PrismaCategoryRepository extends BasePrismaRepository implements CategoryRepository {
  async findAll(params: {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    search?: string;
  }): Promise<{
    data: CategoryResponse[];
    pagination: BasePagination;
  }> {
    return this.executeWithErrorHandling(async () => {
      const {
        page = 1,
        limit = 10,
        sort = 'createdAt',
        order = 'desc',
        search
      } = params;

      this.validatePaginationParams({ page, limit, sort, order });
      const where = this.buildWhereClause({ search });
      const { skip, take, orderBy } = this.buildQueryParams({ page, limit, sort, order });

      const total = await this.prismaClient.category.count({ where });
      const categories = await this.prismaClient.category.findMany({
        where,
        skip,
        take,
        orderBy
      });

      return {
        data: categories,
        pagination: this.buildPagination(total, page, limit)
      };
    }, 'finding all categories', { page: params.page, limit: params.limit, sort: params.sort, order: params.order, search: params.search });
  }

  async findById(id: number): Promise<CategoryResponse | null> {
    return this.executeWithErrorHandling(
      async () => {
        return await this.prismaClient.category.findUnique({
          where: { id }
        });
      },
      'finding category by ID',
      { id }
    );
  }

  async create(data: CategoryCreateInput): Promise<CategoryResponse> {
    return this.executeWithErrorHandling(
      async () => {
        return await this.prismaClient.category.create({
          data
        });
      },
      'creating category',
      { name: data.name }
    );
  }

  async update(id: number, data: CategoryUpdateInput): Promise<CategoryResponse> {
    return this.executeWithErrorHandling(
      async () => {
        return await this.prismaClient.category.update({
          where: { id },
          data
        });
      },
      'updating category',
      { id, ...data }
    );
  }

  async delete(id: number): Promise<void> {
    return this.executeWithErrorHandling(
      async () => {
        await this.prismaClient.category.delete({
          where: { id }
        });
      },
      'deleting category',
      { id }
    );
  }

  async existsByName(name: string): Promise<boolean> {
    return this.executeWithErrorHandling(
      async () => {
        const category = await this.prismaClient.category.findFirst({
          where: { name }
        });
        return !!category;
      },
      'checking if category exists by name',
      { name }
    );
  }

  async findWithProjects(id: number): Promise<CategoryWithProjects | null> {
    return this.executeWithErrorHandling(
      async () => {
        return await this.prismaClient.category.findUnique({
          where: { id },
          include: {
            projects: {
              include: {
                project: true
              }
            }
          }
        });
      },
      'finding category with projects',
      { id }
    );
  }

  async findByName(name: string): Promise<CategoryResponse | null> {
    return this.executeWithErrorHandling(
      async () => {
        return await this.prismaClient.category.findFirst({
          where: { name }
        });
      },
      'finding category by name',
      { name }
    );
  }

  async findByIdWithProjects(id: number): Promise<CategoryWithProjects | null> {
    return this.executeWithErrorHandling(
      async () => {
        return await this.prismaClient.category.findUnique({
          where: { id },
          include: {
            projects: {
              include: {
                project: true
              }
            }
          }
        });
      },
      'finding category with projects by ID',
      { id }
    );
  }

  async getProjectsByCategory(categoryId: number): Promise<any[]> {
    return this.executeWithErrorHandling(
      async () => {
        const projectCategories = await this.prismaClient.projectCategory.findMany({
          where: { categoryId },
          include: {
            project: {
              select: {
                id: true,
                title: true,
                desc: true,
                logo: true,
                twitter: true,
                discord: true,
                telegram: true,
                website: true,
                createdAt: true,
                updatedAt: true
              }
            }
          }
        });

        return projectCategories.map((pc: any) => pc.project);
      },
      'finding projects by category',
      { categoryId }
    );
  }
} 