import { UnstakingQueueRawData, UnstakingQueueInfo, PaginationParams, PaginatedResponse } from '../../types/staking.types';
import { HypurrscanUnstakingClient } from '../../clients/hypurrscan/unstaking.client';
import { redisService } from '../../core/redis.service';
import { ValidatorError } from '../../errors/staking.errors';
import { logDeduplicator } from '../../utils/logDeduplicator';

export class UnstakingService {
  private static instance: UnstakingService;
  private readonly unstakingClient: HypurrscanUnstakingClient;
  private readonly UPDATE_CHANNEL = 'hypurrscan:unstaking:updated';
  private lastUpdate: number = 0;

  // HYPE utilise 8 décimales (10^8)
  private static readonly HYPE_DECIMALS = 8;
  private static readonly WEI_DIVISOR = Math.pow(10, UnstakingService.HYPE_DECIMALS);
  
  // Pagination par défaut
  private static readonly DEFAULT_PAGE = 1;
  private static readonly DEFAULT_LIMIT = 50;
  private static readonly MAX_LIMIT = 200;

  private constructor() {
    this.unstakingClient = HypurrscanUnstakingClient.getInstance();
    this.setupSubscriptions();
  }

  private setupSubscriptions(): void {
    redisService.subscribe(this.UPDATE_CHANNEL, async (message) => {
      try {
        const { type, timestamp } = JSON.parse(message);
        if (type === 'DATA_UPDATED') {
          this.lastUpdate = timestamp;
          logDeduplicator.info('Unstaking queue data updated', { timestamp });
        }
      } catch (error) {
        logDeduplicator.error('Error processing unstaking cache update:', { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    });
  }

  public static getInstance(): UnstakingService {
    if (!UnstakingService.instance) {
      UnstakingService.instance = new UnstakingService();
    }
    return UnstakingService.instance;
  }

  /**
   * Convertit les wei en HYPE (divise par 10^8)
   */
  private weiToHype(wei: number): number {
    return wei / UnstakingService.WEI_DIVISOR;
  }

  /**
   * Convertit un timestamp en string ISO
   */
  private timestampToISOString(timestamp: number): string {
    return new Date(timestamp).toISOString();
  }

  /**
   * Formate les données brutes en données lisibles
   */
  private formatUnstakingData(rawData: UnstakingQueueRawData[]): UnstakingQueueInfo[] {
    return rawData
      .map(item => ({
        time: this.timestampToISOString(item.time),
        user: item.user,
        amount: this.weiToHype(item.wei)
      }))
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()); // Trier par date décroissante
  }

  /**
   * Applique la pagination aux données
   */
  private paginateData<T>(data: T[], page: number, limit: number): PaginatedResponse<T> {
    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = data.slice(startIndex, endIndex);

    return {
      data: paginatedData,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    };
  }

  /**
   * Récupère toutes les données de la queue de unstaking formatées avec pagination
   */
  public async getUnstakingQueue(params: PaginationParams = {}): Promise<PaginatedResponse<UnstakingQueueInfo>> {
    try {
      const page = Math.max(1, params.page || UnstakingService.DEFAULT_PAGE);
      const limit = Math.min(
        UnstakingService.MAX_LIMIT, 
        Math.max(1, params.limit || UnstakingService.DEFAULT_LIMIT)
      );

      const rawUnstaking = await this.unstakingClient.getUnstakingQueue();
      const formattedUnstaking = this.formatUnstakingData(rawUnstaking);
      const paginatedResult = this.paginateData(formattedUnstaking, page, limit);

      logDeduplicator.info('Unstaking queue retrieved and formatted successfully', { 
        totalCount: rawUnstaking.length,
        formattedCount: formattedUnstaking.length,
        page,
        limit,
        totalPages: paginatedResult.pagination.totalPages,
        lastUpdate: this.lastUpdate
      });

      return paginatedResult;
    } catch (error) {
      logDeduplicator.error('Error fetching and formatting unstaking queue:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw new ValidatorError('Failed to fetch unstaking queue data');
    }
  }

  /**
   * Démarre le polling du client
   */
  public startPolling(): void {
    this.unstakingClient.startPolling();
  }

  /**
   * Arrête le polling du client
   */
  public stopPolling(): void {
    this.unstakingClient.stopPolling();
  }
} 