import { PublicGoodRepository } from '../interfaces/publicgood.repository.interface';
import { PublicGoodResponse, PublicGoodCreateInput, PublicGoodUpdateInput } from '../../types/publicgood.types';
import { BasePagination } from '../../types/common.types';
import { BasePrismaRepository } from './base-prisma.repository';
import { ProjectStatus } from '@prisma/client';

export class PrismaPublicGoodRepository extends BasePrismaRepository implements PublicGoodRepository {
  // Helper pour les includes répétitifs
  private readonly includeConfig = {
    submittedBy: {
      select: {
        id: true,
        name: true,
        email: true
      }
    },
    reviewedBy: {
      select: {
        id: true,
        name: true,
        email: true
      }
    }
  };

  async findAll(params: {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    search?: string;
    status?: ProjectStatus;
    category?: string;
    developmentStatus?: string;
  }): Promise<{
    data: PublicGoodResponse[];
    pagination: BasePagination;
  }> {
    return this.executeWithErrorHandling(async () => {
      const {
        page = 1,
        limit = 50,
        sort = 'submittedAt',
        order = 'desc',
        search,
        status,
        category,
        developmentStatus
      } = params;

      this.validatePaginationParams({ page, limit, sort, order });
      
      const where: any = {};
      
      // Filtrer par status
      if (status) {
        where.status = status;
      }
      
      // Filtrer par catégorie
      if (category) {
        where.category = { contains: category, mode: 'insensitive' };
      }
      
      // Filtrer par development status
      if (developmentStatus) {
        where.developmentStatus = developmentStatus;
      }
      
      // Recherche dans name, description, problemSolved, technologies
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { problemSolved: { contains: search, mode: 'insensitive' } },
          { technologies: { has: search } }
        ];
      }
      
      const { skip, take, orderBy } = this.buildQueryParams({ page, limit, sort, order });

      const total = await this.prismaClient.publicGood.count({ where });
      const publicGoods = await this.prismaClient.publicGood.findMany({
        where,
        skip,
        take,
        orderBy,
        include: this.includeConfig
      });

      return {
        data: publicGoods as PublicGoodResponse[],
        pagination: this.buildPagination(total, page, limit)
      };
    }, 'finding all public goods', params);
  }

  async findById(id: number): Promise<PublicGoodResponse | null> {
    return this.executeWithErrorHandling(
      async () => {
        const publicGood = await this.prismaClient.publicGood.findUnique({
          where: { id },
          include: this.includeConfig
        });

        return publicGood as PublicGoodResponse | null;
      },
      'finding public good by ID',
      { id }
    );
  }

  async create(data: PublicGoodCreateInput): Promise<PublicGoodResponse> {
    return this.executeWithErrorHandling(
      async () => {
        const publicGood = await this.prismaClient.publicGood.create({
          data: {
            ...data,
            submitterId: data.submitterId!,
            status: 'PENDING' as ProjectStatus
          },
          include: this.includeConfig
        });

        return publicGood as PublicGoodResponse;
      },
      'creating public good',
      { name: data.name }
    );
  }

  async update(id: number, data: PublicGoodUpdateInput): Promise<PublicGoodResponse> {
    return this.executeWithErrorHandling(
      async () => {
        const publicGood = await this.prismaClient.publicGood.update({
          where: { id },
          data,
          include: this.includeConfig
        });

        return publicGood as PublicGoodResponse;
      },
      'updating public good',
      { id, ...data }
    );
  }

  async delete(id: number): Promise<void> {
    return this.executeWithErrorHandling(
      async () => {
        await this.prismaClient.publicGood.delete({
          where: { id }
        });
      },
      'deleting public good',
      { id }
    );
  }

  async existsByName(name: string): Promise<boolean> {
    return this.executeWithErrorHandling(
      async () => {
        const publicGood = await this.prismaClient.publicGood.findFirst({
          where: { name }
        });
        return !!publicGood;
      },
      'checking if public good exists by name',
      { name }
    );
  }

  async findBySubmitter(submitterId: number, params: {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
  }): Promise<{
    data: PublicGoodResponse[];
    pagination: BasePagination;
  }> {
    return this.executeWithErrorHandling(async () => {
      const {
        page = 1,
        limit = 50,
        sort = 'submittedAt',
        order = 'desc'
      } = params;

      this.validatePaginationParams({ page, limit, sort, order });
      
      const where = { submitterId };
      const { skip, take, orderBy } = this.buildQueryParams({ page, limit, sort, order });

      const total = await this.prismaClient.publicGood.count({ where });
      const publicGoods = await this.prismaClient.publicGood.findMany({
        where,
        skip,
        take,
        orderBy,
        include: this.includeConfig
      });

      return {
        data: publicGoods as PublicGoodResponse[],
        pagination: this.buildPagination(total, page, limit)
      };
    }, 'finding public goods by submitter', { submitterId, ...params });
  }

  async findPending(params: {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
  }): Promise<{
    data: PublicGoodResponse[];
    pagination: BasePagination;
  }> {
    return this.executeWithErrorHandling(async () => {
      const {
        page = 1,
        limit = 50,
        sort = 'submittedAt',
        order = 'desc'
      } = params;

      this.validatePaginationParams({ page, limit, sort, order });
      
      const where = { status: 'PENDING' as ProjectStatus };
      const { skip, take, orderBy } = this.buildQueryParams({ page, limit, sort, order });

      const total = await this.prismaClient.publicGood.count({ where });
      const publicGoods = await this.prismaClient.publicGood.findMany({
        where,
        skip,
        take,
        orderBy,
        include: this.includeConfig
      });

      return {
        data: publicGoods as PublicGoodResponse[],
        pagination: this.buildPagination(total, page, limit)
      };
    }, 'finding pending public goods', params);
  }

  async review(id: number, reviewData: {
    status: ProjectStatus;
    reviewerId: number;
    reviewNotes?: string;
  }): Promise<PublicGoodResponse> {
    return this.executeWithErrorHandling(
      async () => {
        const publicGood = await this.prismaClient.publicGood.update({
          where: { id },
          data: {
            status: reviewData.status,
            reviewerId: reviewData.reviewerId,
            reviewedAt: new Date(),
            reviewNotes: reviewData.reviewNotes
          },
          include: this.includeConfig
        });

        return publicGood as PublicGoodResponse;
      },
      'reviewing public good',
      { id, ...reviewData }
    );
  }

  async isOwner(id: number, userId: number): Promise<boolean> {
    return this.executeWithErrorHandling(
      async () => {
        const publicGood = await this.prismaClient.publicGood.findFirst({
          where: { 
            id,
            submitterId: userId
          }
        });
        return !!publicGood;
      },
      'checking if user is owner',
      { id, userId }
    );
  }
}

