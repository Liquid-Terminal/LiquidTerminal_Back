import { ReadListRepository } from '../interfaces/readlist.repository.interface';
import { 
  ReadListResponse, 
  ReadListCreateInput, 
  ReadListUpdateInput,
  ReadListSummaryResponse
} from '../../types/readlist.types';
import { BasePagination } from '../../types/common.types';
import { prisma } from '../../core/prisma.service';
import { logDeduplicator } from '../../utils/logDeduplicator';

export class PrismaReadListRepository implements ReadListRepository {
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
    items: {
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
      },
      orderBy: [
        { order: 'asc' },
        { addedAt: 'asc' }
      ]
    }
  };

  private readonly summaryIncludeConfig = {
    creator: {
      select: {
        id: true,
        name: true,
        email: true
      }
    },
    _count: {
      select: {
        items: true
      }
    }
  };

  setPrismaClient(prismaClient: any): void {
    this.prismaClient = prismaClient;
    logDeduplicator.info('Prisma client updated in readlist repository');
  }

  resetPrismaClient(): void {
    this.prismaClient = prisma;
    logDeduplicator.info('Prisma client reset to default in readlist repository');
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
    userId?: number;
    isPublic?: boolean;
  }): Promise<{
    data: ReadListSummaryResponse[];
    pagination: BasePagination;
  }> {
    try {
      const {
        page = 1,
        limit = 10,
        sort = 'updatedAt',
        order = 'desc',
        search,
        userId,
        isPublic
      } = params;

      const skip = (page - 1) * limit;

      const where: any = {};
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ];
      }
      if (userId !== undefined) {
        where.userId = userId;
      }
      if (isPublic !== undefined) {
        where.isPublic = isPublic;
      }

      logDeduplicator.info('Finding all read lists', { page, limit, sort, order, search, userId, isPublic });

      const total = await this.prismaClient.readList.count({ where });
      const readLists = await this.prismaClient.readList.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort]: order },
        include: this.summaryIncludeConfig
      });

      // Transform data to include itemsCount
      const data = readLists.map((readList: any) => ({
        ...readList,
        itemsCount: readList._count.items,
        _count: undefined
      }));

      logDeduplicator.info('Read lists found successfully', { count: data.length, total });

      const totalPages = Math.ceil(total / limit);
      return {
        data,
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
      logDeduplicator.error('Error finding all read lists', { error, params });
      throw error;
    }
  }

  async findById(id: number): Promise<ReadListResponse | null> {
    return this.executeWithErrorHandling(
      async () => {
        const readList = await this.prismaClient.readList.findUnique({
          where: { id },
          include: this.includeConfig
        });
        return readList;
      },
      'finding read list by ID',
      { id }
    );
  }

  async findSummaryById(id: number): Promise<ReadListSummaryResponse | null> {
    return this.executeWithErrorHandling(
      async () => {
        const readList = await this.prismaClient.readList.findUnique({
          where: { id },
          include: this.summaryIncludeConfig
        });

        if (!readList) return null;

        return {
          ...readList,
          itemsCount: readList._count.items,
          _count: undefined
        };
      },
      'finding read list summary by ID',
      { id }
    );
  }

  async create(data: ReadListCreateInput): Promise<ReadListResponse> {
    return this.executeWithErrorHandling(
      async () => {
        const readList = await this.prismaClient.readList.create({
          data: {
            name: data.name,
            description: data.description,
            isPublic: data.isPublic,
            creator: {
              connect: { id: data.userId }
            }
          },
          include: this.includeConfig
        });
        return readList;
      },
      'creating read list',
      { name: data.name, userId: data.userId }
    );
  }

  async update(id: number, data: ReadListUpdateInput): Promise<ReadListResponse> {
    return this.executeWithErrorHandling(
      async () => {
        const readList = await this.prismaClient.readList.update({
          where: { id },
          data,
          include: this.includeConfig
        });
        return readList;
      },
      'updating read list',
      { id, ...data }
    );
  }

  async delete(id: number): Promise<void> {
    return this.executeWithErrorHandling(
      async () => {
        await this.prismaClient.readList.delete({
          where: { id }
        });
      },
      'deleting read list',
      { id }
    );
  }

  async existsByNameAndUser(name: string, userId: number): Promise<boolean> {
    return this.executeWithErrorHandling(
      async () => {
        const readList = await this.prismaClient.readList.findFirst({
          where: { name, userId }
        });
        return !!readList;
      },
      'checking if read list exists by name and user',
      { name, userId }
    );
  }

  async findByUser(userId: number): Promise<ReadListSummaryResponse[]> {
    return this.executeWithErrorHandling(
      async () => {
        const readLists = await this.prismaClient.readList.findMany({
          where: { userId },
          include: this.summaryIncludeConfig,
          orderBy: { updatedAt: 'desc' }
        });

        return readLists.map((readList: any) => ({
          ...readList,
          itemsCount: readList._count.items,
          _count: undefined
        }));
      },
      'finding read lists by user',
      { userId }
    );
  }

  async findPublicLists(params: {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    search?: string;
  }): Promise<{
    data: ReadListSummaryResponse[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    return this.findAll({ ...params, isPublic: true });
  }

  async hasAccess(readListId: number, userId: number): Promise<boolean> {
    return this.executeWithErrorHandling(
      async () => {
        const readList = await this.prismaClient.readList.findUnique({
          where: { id: readListId },
          select: { userId: true, isPublic: true }
        });

        if (!readList) return false;
        return readList.userId === userId || readList.isPublic;
      },
      'checking read list access',
      { readListId, userId }
    );
  }

  async updateItemsCount(readListId: number): Promise<void> {
    return this.executeWithErrorHandling(
      async () => {
        // Cette méthode peut être utilisée pour maintenir un compteur dénormalisé si nécessaire
        // Pour l'instant, nous utilisons _count dans les requêtes
        logDeduplicator.info('Items count update requested', { readListId });
      },
      'updating items count',
      { readListId }
    );
  }
} 