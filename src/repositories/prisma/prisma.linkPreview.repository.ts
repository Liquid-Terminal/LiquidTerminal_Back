import { LinkPreviewRepository } from '../interfaces/linkPreview.repository.interface';
import { 
  LinkPreviewResponse, 
  LinkPreviewCreateInput, 
  LinkPreviewUpdateInput
} from '../../types/linkPreview.types';
import { BasePagination } from '../../types/common.types';
import { prisma } from '../../core/prisma.service';
import { logDeduplicator } from '../../utils/logDeduplicator';

export class PrismaLinkPreviewRepository implements LinkPreviewRepository {
  private prismaClient: any = prisma;

  setPrismaClient(prismaClient: any): void {
    this.prismaClient = prismaClient;
    logDeduplicator.info('Prisma client updated in link preview repository');
  }

  resetPrismaClient(): void {
    this.prismaClient = prisma;
    logDeduplicator.info('Prisma client reset to default in link preview repository');
  }

  private executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: Record<string, any>
  ): Promise<T> {
    return operation().catch((error) => {
      logDeduplicator.error(`Error ${operationName}`, { error, context });
      throw error;
    });
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    search?: string;
  }): Promise<{
    data: LinkPreviewResponse[];
    pagination: BasePagination;
  }> {
    try {
      const {
        page = 1,
        limit = 10,
        sort = 'createdAt',
        order = 'desc',
        search
      } = params;

      const skip = (page - 1) * limit;

      const where: any = {};
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { siteName: { contains: search, mode: 'insensitive' } },
          { url: { contains: search, mode: 'insensitive' } }
        ];
      }

      logDeduplicator.info('Finding all link previews', { page, limit, sort, order, search });

      const total = await this.prismaClient.linkPreview.count({ where });
      const linkPreviews = await this.prismaClient.linkPreview.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort]: order }
      });

      logDeduplicator.info('Link previews found successfully', { count: linkPreviews.length, total });

      const totalPages = Math.ceil(total / limit);
      return {
        data: linkPreviews,
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
      logDeduplicator.error('Error finding all link previews', { error, params });
      throw error;
    }
  }

  async findById(id: string): Promise<LinkPreviewResponse | null> {
    return this.executeWithErrorHandling(
      async () => {
        logDeduplicator.info('Finding link preview by ID', { id });
        
        const linkPreview = await this.prismaClient.linkPreview.findUnique({
          where: { id }
        });

        if (linkPreview) {
          logDeduplicator.info('Link preview found successfully', { id });
        } else {
          logDeduplicator.info('Link preview not found', { id });
        }

        return linkPreview;
      },
      'finding link preview by ID',
      { id }
    );
  }

  async findByUrl(url: string): Promise<LinkPreviewResponse | null> {
    return this.executeWithErrorHandling(
      async () => {
        logDeduplicator.info('Finding link preview by URL', { url });
        
        const linkPreview = await this.prismaClient.linkPreview.findUnique({
          where: { url }
        });

        if (linkPreview) {
          logDeduplicator.info('Link preview found by URL successfully', { url });
        } else {
          logDeduplicator.info('Link preview not found by URL', { url });
        }

        return linkPreview;
      },
      'finding link preview by URL',
      { url }
    );
  }

  async create(data: LinkPreviewCreateInput): Promise<LinkPreviewResponse> {
    return this.executeWithErrorHandling(
      async () => {
        logDeduplicator.info('Creating link preview', { url: data.url });
        
        const linkPreview = await this.prismaClient.linkPreview.create({
          data
        });

        logDeduplicator.info('Link preview created successfully', { id: linkPreview.id, url: linkPreview.url });
        
        return linkPreview;
      },
      'creating link preview',
      { url: data.url }
    );
  }

  async update(id: string, data: LinkPreviewUpdateInput): Promise<LinkPreviewResponse> {
    return this.executeWithErrorHandling(
      async () => {
        logDeduplicator.info('Updating link preview', { id });
        
        const linkPreview = await this.prismaClient.linkPreview.update({
          where: { id },
          data: {
            ...data,
            updatedAt: new Date()
          }
        });

        logDeduplicator.info('Link preview updated successfully', { id });
        
        return linkPreview;
      },
      'updating link preview',
      { id }
    );
  }

  async delete(id: string): Promise<void> {
    return this.executeWithErrorHandling(
      async () => {
        logDeduplicator.info('Deleting link preview', { id });
        
        await this.prismaClient.linkPreview.delete({
          where: { id }
        });

        logDeduplicator.info('Link preview deleted successfully', { id });
      },
      'deleting link preview',
      { id }
    );
  }

  async existsByUrl(url: string): Promise<boolean> {
    return this.executeWithErrorHandling(
      async () => {
        const count = await this.prismaClient.linkPreview.count({
          where: { url }
        });
        return count > 0;
      },
      'checking if link preview exists by URL',
      { url }
    );
  }

  async upsert(url: string, data: LinkPreviewCreateInput): Promise<LinkPreviewResponse> {
    return this.executeWithErrorHandling(
      async () => {
        logDeduplicator.info('Upserting link preview', { url });
        
        const linkPreview = await this.prismaClient.linkPreview.upsert({
          where: { url },
          update: {
            ...data,
            updatedAt: new Date()
          },
          create: data
        });

        logDeduplicator.info('Link preview upserted successfully', { id: linkPreview.id, url });
        
        return linkPreview;
      },
      'upserting link preview',
      { url }
    );
  }

  async findExpiredPreviews(expiredBefore: Date, limit: number = 50): Promise<LinkPreviewResponse[]> {
    return this.executeWithErrorHandling(
      async () => {
        logDeduplicator.info('Finding expired link previews', { expiredBefore, limit });
        
        const expiredPreviews = await this.prismaClient.linkPreview.findMany({
          where: {
            updatedAt: {
              lt: expiredBefore
            }
          },
          take: limit,
          orderBy: { updatedAt: 'asc' }
        });

        logDeduplicator.info('Expired link previews found', { count: expiredPreviews.length });
        
        return expiredPreviews;
      },
      'finding expired link previews',
      { expiredBefore, limit }
    );
  }
} 