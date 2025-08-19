import { ReadListItemRepository } from '../interfaces/readlist-item.repository.interface';
import { 
  ReadListItemResponse, 
  ReadListItemCreateInput, 
  ReadListItemUpdateInput
} from '../../types/readlist.types';
import { BasePagination } from '../../types/common.types';
import { prisma } from '../../core/prisma.service';
import { logDeduplicator } from '../../utils/logDeduplicator';

export class PrismaReadListItemRepository implements ReadListItemRepository {
  private prismaClient: any = prisma;

  // Helper pour les includes répétitifs
  private readonly includeConfig = {
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
  };

  setPrismaClient(prismaClient: any): void {
    this.prismaClient = prismaClient;
    logDeduplicator.info('Prisma client updated in readlist item repository');
  }

  resetPrismaClient(): void {
    this.prismaClient = prisma;
    logDeduplicator.info('Prisma client reset to default in readlist item repository');
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
    readListId?: number;
    isRead?: boolean;
  }): Promise<{
    data: ReadListItemResponse[];
    pagination: BasePagination;
  }> {
    try {
      const {
        page = 1,
        limit = 10,
        sort = 'addedAt',
        order = 'desc',
        search,
        readListId,
        isRead
      } = params;

      const skip = (page - 1) * limit;

      const where: any = {};
      if (search) {
        where.OR = [
          { notes: { contains: search, mode: 'insensitive' } },
          { resource: { url: { contains: search, mode: 'insensitive' } } }
        ];
      }
      if (readListId !== undefined) {
        where.readListId = readListId;
      }
      if (isRead !== undefined) {
        where.isRead = isRead;
      }

      logDeduplicator.info('Finding all read list items', { page, limit, sort, order, search, readListId, isRead });

      const total = await this.prismaClient.readListItem.count({ where });
      
      // Custom orderBy logic for different sort fields
      let orderBy: any = { [sort]: order };
      if (sort === 'order') {
        orderBy = [
          { order: order === 'asc' ? 'asc' : 'desc' },
          { addedAt: 'asc' } // Secondary sort by addedAt for items with same order
        ];
      }

      const items = await this.prismaClient.readListItem.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: this.includeConfig
      });

      logDeduplicator.info('Read list items found successfully', { count: items.length, total });

      const totalPages = Math.ceil(total / limit);
      return {
        data: items,
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
      logDeduplicator.error('Error finding all read list items', { error, params });
      throw error;
    }
  }

  async findById(id: number): Promise<ReadListItemResponse | null> {
    return this.executeWithErrorHandling(
      async () => {
        const item = await this.prismaClient.readListItem.findUnique({
          where: { id },
          include: this.includeConfig
        });
        return item;
      },
      'finding read list item by ID',
      { id }
    );
  }

  async create(data: ReadListItemCreateInput): Promise<ReadListItemResponse> {
    return this.executeWithErrorHandling(
      async () => {
        // Si aucun ordre n'est spécifié, utiliser le prochain ordre disponible
        let finalData = { ...data };
        if (finalData.order === undefined || finalData.order === null) {
          if (!data.readListId) {
            throw new Error('readListId is required to determine order');
          }
          finalData.order = await this.getNextOrder(data.readListId);
        }

        if (!data.readListId) {
          throw new Error('readListId is required');
        }
        
        const item = await this.prismaClient.readListItem.create({
          data: {
            notes: finalData.notes,
            order: finalData.order,
            readList: {
              connect: { id: data.readListId }
            },
            resource: {
              connect: { id: data.resourceId }
            }
          },
          include: this.includeConfig
        });
        return item;
      },
      'creating read list item',
      { readListId: data.readListId, resourceId: data.resourceId }
    );
  }

  async update(id: number, data: ReadListItemUpdateInput): Promise<ReadListItemResponse> {
    return this.executeWithErrorHandling(
      async () => {
        const item = await this.prismaClient.readListItem.update({
          where: { id },
          data,
          include: this.includeConfig
        });
        return item;
      },
      'updating read list item',
      { id, ...data }
    );
  }

  async delete(id: number): Promise<void> {
    return this.executeWithErrorHandling(
      async () => {
        await this.prismaClient.readListItem.delete({
          where: { id }
        });
      },
      'deleting read list item',
      { id }
    );
  }

  async findByReadList(readListId: number, params?: {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    isRead?: boolean;
  }): Promise<{
    data: ReadListItemResponse[];
    pagination: BasePagination;
  }> {
    return this.findAll({ ...params, readListId });
  }

  async existsInReadList(readListId: number, resourceId: number): Promise<boolean> {
    return this.executeWithErrorHandling(
      async () => {
        const item = await this.prismaClient.readListItem.findFirst({
          where: { readListId, resourceId }
        });
        return !!item;
      },
      'checking if resource exists in read list',
      { readListId, resourceId }
    );
  }

  async toggleReadStatus(id: number, isRead: boolean): Promise<ReadListItemResponse> {
    return this.executeWithErrorHandling(
      async () => {
        const item = await this.prismaClient.readListItem.update({
          where: { id },
          data: { isRead },
          include: this.includeConfig
        });
        return item;
      },
      'toggling read status',
      { id, isRead }
    );
  }

  async reorderItems(readListId: number, itemOrders: { id: number; order: number }[]): Promise<void> {
    return this.executeWithErrorHandling(
      async () => {
        // Utiliser une transaction pour garantir la cohérence
        await this.prismaClient.$transaction(
          itemOrders.map(({ id, order }) =>
            this.prismaClient.readListItem.update({
              where: { id, readListId }, // S'assurer que l'item appartient à la bonne readList
              data: { order }
            })
          )
        );
      },
      'reordering items',
      { readListId, itemsCount: itemOrders.length }
    );
  }

  async getNextOrder(readListId: number): Promise<number> {
    return this.executeWithErrorHandling(
      async () => {
        const lastItem = await this.prismaClient.readListItem.findFirst({
          where: { readListId },
          orderBy: { order: 'desc' },
          select: { order: true }
        });
        
        return lastItem?.order !== null && lastItem?.order !== undefined 
          ? lastItem.order + 1 
          : 0;
      },
      'getting next order',
      { readListId }
    );
  }

  async deleteByReadList(readListId: number): Promise<void> {
    return this.executeWithErrorHandling(
      async () => {
        await this.prismaClient.readListItem.deleteMany({
          where: { readListId }
        });
      },
      'deleting all items from read list',
      { readListId }
    );
  }

  async countByReadList(readListId: number): Promise<number> {
    return this.executeWithErrorHandling(
      async () => {
        const count = await this.prismaClient.readListItem.count({
          where: { readListId }
        });
        return count;
      },
      'counting items by read list',
      { readListId }
    );
  }

  async countByReadStatus(readListId: number, isRead: boolean): Promise<number> {
    return this.executeWithErrorHandling(
      async () => {
        const count = await this.prismaClient.readListItem.count({
          where: { readListId, isRead }
        });
        return count;
      },
      'counting items by read status',
      { readListId, isRead }
    );
  }
} 