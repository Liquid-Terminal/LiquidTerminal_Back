import { HypurrscanStakedHoldersClient } from '../../clients/hypurrscan/stakedHolders.client';
import { StakedHoldersData, StakedHolder } from '../../types/staking.types';

export class StakedHoldersService {
  private static instance: StakedHoldersService;
  private readonly client: HypurrscanStakedHoldersClient;

  private constructor() {
    this.client = HypurrscanStakedHoldersClient.getInstance();
  }

  public static getInstance(): StakedHoldersService {
    if (!StakedHoldersService.instance) {
      StakedHoldersService.instance = new StakedHoldersService();
    }
    return StakedHoldersService.instance;
  }

  /**
   * Récupère les holders de stakedHYPE avec pagination et tri
   */
  public async getStakedHolders(page: number = 1, limit: number = 100): Promise<{
    holders: StakedHolder[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    metadata: {
      token: string;
      lastUpdate: number;
      holdersCount: number;
    };
  }> {
    // Validation des paramètres
    if (page < 1) {
      throw new Error('Page must be greater than 0');
    }

    if (limit < 1 || limit > 1000) {
      throw new Error('Limit must be between 1 and 1000');
    }

    try {
      const data: StakedHoldersData = await this.client.getStakedHolders();

      // Convertir les holders en array et trier par montant décroissant
      const holdersArray = Object.entries(data.holders)
        .map(([address, amount]) => ({ address, amount }))
        .sort((a, b) => b.amount - a.amount);

      // Pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedHolders = holdersArray.slice(startIndex, endIndex);

      const totalPages = Math.ceil(holdersArray.length / limit);

      return {
        holders: paginatedHolders,
        pagination: {
          page,
          limit,
          total: holdersArray.length,
          totalPages
        },
        metadata: {
          token: data.token,
          lastUpdate: data.lastUpdate,
          holdersCount: data.holdersCount
        }
      };
    } catch (error) {
      throw new Error(`Failed to fetch staked holders: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Récupère un holder spécifique par son adresse
   */
  public async getHolderByAddress(address: string): Promise<StakedHolder | null> {
    if (!address || typeof address !== 'string') {
      throw new Error('Valid address is required');
    }

    try {
      const data: StakedHoldersData = await this.client.getStakedHolders();
      
      // Chercher le holder par adresse
      const amount = data.holders[address.toLowerCase()];
      
      if (amount !== undefined) {
        return { address, amount };
      }

      return null;
    } catch (error) {
      throw new Error(`Failed to fetch holder by address: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Récupère les top holders
   */
  public async getTopHolders(limit: number = 10): Promise<StakedHolder[]> {
    if (limit < 1 || limit > 100) {
      throw new Error('Limit must be between 1 and 100');
    }

    try {
      const result = await this.getStakedHolders(1, limit);
      return result.holders;
    } catch (error) {
      throw new Error(`Failed to fetch top holders: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Récupère les statistiques des holders
   */
  public async getHoldersStats(): Promise<{
    totalHolders: number;
    totalStaked: number;
    averageStaked: number;
    lastUpdate: number;
    distributionByRange: {
      range: string;
      holdersCount: number;
      totalStaked: number;
      percentage: number;
    }[];
    topHoldersStats: {
      topCount: number;
      totalStaked: number;
      percentage: number;
    }[];
  }> {
    try {
      const data: StakedHoldersData = await this.client.getStakedHolders();
      
      // Convertir et trier les holders par montant décroissant
      const holdersArray = Object.entries(data.holders)
        .map(([address, amount]) => ({ address, amount }))
        .sort((a, b) => b.amount - a.amount);

      const amounts = holdersArray.map(holder => holder.amount);
      const totalStaked = amounts.reduce((sum, amount) => sum + amount, 0);
      const averageStaked = amounts.length > 0 ? totalStaked / amounts.length : 0;

      // Définir les ranges
      const ranges = [
        { min: 0, max: 10, label: '0-10' },
        { min: 10, max: 50, label: '10-50' },
        { min: 50, max: 250, label: '50-250' },
        { min: 250, max: 1000, label: '250-1000' },
        { min: 1000, max: 5000, label: '1000-5000' },
        { min: 5000, max: 25000, label: '5000-25000' },
        { min: 25000, max: 100000, label: '25000-100000' },
        { min: 100000, max: Infinity, label: '100000+' }
      ];

      // Calculer la distribution par range
      const distributionByRange = ranges.map(range => {
        const holdersInRange = holdersArray.filter(holder => 
          holder.amount >= range.min && holder.amount < range.max
        );
        
        const holdersCount = holdersInRange.length;
        const rangeTotal = holdersInRange.reduce((sum, holder) => sum + holder.amount, 0);
        const percentage = totalStaked > 0 ? (rangeTotal / totalStaked) * 100 : 0;

        return {
          range: range.label,
          holdersCount,
          totalStaked: rangeTotal,
          percentage: Math.round(percentage * 100) / 100 // Arrondir à 2 décimales
        };
      });

      // Définir les tops à calculer
      const topCounts = [10, 50, 100, 500, 1000, 5000, 10000];

      // Calculer les stats des top holders
      const topHoldersStats = topCounts.map(topCount => {
        const topHolders = holdersArray.slice(0, Math.min(topCount, holdersArray.length));
        const topTotal = topHolders.reduce((sum, holder) => sum + holder.amount, 0);
        const percentage = totalStaked > 0 ? (topTotal / totalStaked) * 100 : 0;

        return {
          topCount,
          totalStaked: topTotal,
          percentage: Math.round(percentage * 100) / 100 // Arrondir à 2 décimales
        };
      });

      return {
        totalHolders: data.holdersCount,
        totalStaked,
        averageStaked,
        lastUpdate: data.lastUpdate,
        distributionByRange,
        topHoldersStats
      };
    } catch (error) {
      throw new Error(`Failed to fetch holders stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Vérifie le rate limit pour une IP
   */
  public checkRateLimit(ip: string): boolean {
    return this.client.checkRateLimit(ip);
  }
} 