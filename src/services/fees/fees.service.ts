import { FeeData, FeesStats, FeesError } from '../../types/fees.types';
import { redisService } from '../../core/redis.service';
import { logDeduplicator } from '../../utils/logDeduplicator';

const MICRO_USD_DIVISOR = 1_000_000;

export class FeesService {
  private static instance: FeesService;

  private readonly STATS_CACHE_KEY = 'fees:stats';
  private readonly RAW_DATA_CACHE_KEY = 'fees:raw_data';
  private readonly UPDATE_CHANNEL = 'fees:stats:updated';
  private readonly RAW_DATA_UPDATE_CHANNEL = 'fees:data:updated';
  private lastUpdate: Record<string, number> = {};

  private constructor() {
    this.setupSubscriptions();
  }

  public static getInstance(): FeesService {
    if (!FeesService.instance) {
      FeesService.instance = new FeesService();
    }
    return FeesService.instance;
  }

  private setupSubscriptions(): void {
    redisService.subscribe(this.RAW_DATA_UPDATE_CHANNEL, async (message) => {
      try {
        const { type, timestamp } = JSON.parse(message);
        if (type === 'DATA_UPDATED') {
          await this.updateFeesStats();
          this.lastUpdate['rawData'] = timestamp;
          logDeduplicator.info('Fees raw data updated', { timestamp });
        }
      } catch (error) {
        logDeduplicator.error('Error processing fees raw data update:', { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    });

    redisService.subscribe(this.UPDATE_CHANNEL, async (message) => {
      try {
        const { type, timestamp } = JSON.parse(message);
        if (type === 'STATS_UPDATED') {
          this.lastUpdate['stats'] = timestamp;
          logDeduplicator.info('Fees stats updated', { timestamp });
        }
      } catch (error) {
        logDeduplicator.error('Error processing fees stats update:', { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    });
  }

  private async getRawFeesDataFromCache(): Promise<FeeData[] | null> {
    try {
      const cachedData = await redisService.get(this.RAW_DATA_CACHE_KEY);
      return cachedData ? JSON.parse(cachedData) : null;
    } catch (error) {
      logDeduplicator.error('Error retrieving raw fees data from cache:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return null;
    }
  }

  private async getFeesStatsFromCache(): Promise<FeesStats | null> {
    try {
      const cachedStats = await redisService.get(this.STATS_CACHE_KEY);
      return cachedStats ? JSON.parse(cachedStats) : null;
    } catch (error) {
      logDeduplicator.error('Error retrieving fees stats from cache:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return null;
    }
  }

  private async updateFeesStats(): Promise<FeesStats> {
    try {
      const feesData = await this.getRawFeesDataFromCache();
      if (!feesData?.length) {
        throw new FeesError('No fees data available');
      }

      logDeduplicator.info('Raw fees data received', { 
        dataLength: feesData.length,
        firstEntry: feesData[0],
        lastEntry: feesData[feesData.length - 1]
      });

      const stats = await this.calculateFeesStats(feesData);
      
      await redisService.set(
        this.STATS_CACHE_KEY,
        JSON.stringify(stats)
      );

      const now = Date.now();
      await redisService.publish(this.UPDATE_CHANNEL, JSON.stringify({
        type: 'STATS_UPDATED',
        timestamp: now
      }));

      this.lastUpdate['stats'] = now;

      logDeduplicator.info('Fees stats calculated and cached successfully.', {
        lastUpdate: this.lastUpdate
      });
      return stats;
    } catch (error) {
      logDeduplicator.error('Failed to update fees stats:', { error });
      throw error;
    }
  }

  private convertToUSD(microUsdAmount: number): number {
    return microUsdAmount / MICRO_USD_DIVISOR;
  }

  private findClosestEntry(data: FeeData[], targetTime: number): FeeData | null {
    if (!data.length) return null;

    // Trier les données par timestamp
    const sortedData = [...data].sort((a, b) => a.time - b.time);

    // Trouver la dernière entrée qui n'est pas plus récente que targetTime
    let closestEntry = null;
    for (const entry of sortedData) {
      if (entry.time <= targetTime) {
        closestEntry = entry;
      } else {
        break;
      }
    }

    // Si aucune entrée n'est trouvée avant targetTime, prendre la plus ancienne
    if (!closestEntry && sortedData.length > 0) {
      closestEntry = sortedData[0];
    }

    logDeduplicator.info('Found closest entry', {
      targetTime,
      foundTime: closestEntry?.time,
      difference: closestEntry ? Math.abs(closestEntry.time - targetTime) : null
    });

    return closestEntry;
  }

  private calculateFeeDifference(
    startEntry: FeeData | null, 
    endEntry: FeeData | null, 
    field: keyof Pick<FeeData, 'total_fees' | 'total_spot_fees'>
  ): number {
    if (!startEntry || !endEntry) {
      logDeduplicator.warn('Missing data points for fee calculation', {
        startEntry,
        endEntry,
        field
      });
      return 0;
    }

    const difference = endEntry[field] - startEntry[field];
    
    logDeduplicator.info(`Fee difference calculation for ${field}`, {
      startTime: startEntry.time,
      endTime: endEntry.time,
      startValue: startEntry[field],
      endValue: endEntry[field],
      difference
    });

    return difference;
  }

  private async calculateFeesStats(feesData: FeeData[]): Promise<FeesStats> {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const oneDayAgoInSeconds = nowInSeconds - (24 * 60 * 60);
    const oneHourAgoInSeconds = nowInSeconds - (60 * 60);

    const sortedData = [...feesData].sort((a, b) => a.time - b.time);
    const latestDataTime = sortedData[sortedData.length - 1]?.time;

    logDeduplicator.info('Calculating fees with time ranges', {
      nowInSeconds,
      oneDayAgoInSeconds,
      oneHourAgoInSeconds,
      dataPoints: sortedData.length,
      oldestTime: sortedData[0]?.time,
      newestTime: latestDataTime,
      timeSinceLastData: nowInSeconds - latestDataTime
    });

    // Si nos données sont trop vieilles (plus de 2h), on utilise les dernières données disponibles
    if (nowInSeconds - latestDataTime > 7200) {
      const latestEntry = sortedData[sortedData.length - 1];
      const prevDayEntry = this.findClosestEntry(sortedData, latestDataTime - (24 * 60 * 60));
      const prevHourEntry = this.findClosestEntry(sortedData, latestDataTime - (60 * 60));

      if (!latestEntry) {
        throw new FeesError('No fee data available');
      }

      const dailyFees = this.calculateFeeDifference(prevDayEntry, latestEntry, 'total_fees');
      const dailySpotFees = this.calculateFeeDifference(prevDayEntry, latestEntry, 'total_spot_fees');
      const hourlyFees = this.calculateFeeDifference(prevHourEntry, latestEntry, 'total_fees');
      const hourlySpotFees = this.calculateFeeDifference(prevHourEntry, latestEntry, 'total_spot_fees');

      logDeduplicator.warn('Using old data for fee calculations', {
        latestDataTime,
        timeSinceLastData: nowInSeconds - latestDataTime,
        dailyFees,
        hourlyFees
      });

      return {
        dailyFees: this.convertToUSD(dailyFees),
        dailySpotFees: this.convertToUSD(dailySpotFees),
        hourlyFees: this.convertToUSD(hourlyFees),
        hourlySpotFees: this.convertToUSD(hourlySpotFees)
      };
    }

    // Sinon, on utilise la logique normale
    const latestEntry = this.findClosestEntry(sortedData, nowInSeconds);
    const dayStartEntry = this.findClosestEntry(sortedData, oneDayAgoInSeconds);
    const hourStartEntry = this.findClosestEntry(sortedData, oneHourAgoInSeconds);

    if (!latestEntry) {
      throw new FeesError('No recent fee data available');
    }

    const dailyFees = this.calculateFeeDifference(dayStartEntry, latestEntry, 'total_fees');
    const dailySpotFees = this.calculateFeeDifference(dayStartEntry, latestEntry, 'total_spot_fees');
    const hourlyFees = this.calculateFeeDifference(hourStartEntry, latestEntry, 'total_fees');
    const hourlySpotFees = this.calculateFeeDifference(hourStartEntry, latestEntry, 'total_spot_fees');

    if (dayStartEntry && Math.abs(dayStartEntry.time - oneDayAgoInSeconds) > 3600) {
      logDeduplicator.warn('Daily start entry is too far from target time', {
        targetTime: oneDayAgoInSeconds,
        actualTime: dayStartEntry.time,
        difference: Math.abs(dayStartEntry.time - oneDayAgoInSeconds)
      });
    }

    if (hourStartEntry && Math.abs(hourStartEntry.time - oneHourAgoInSeconds) > 300) {
      logDeduplicator.warn('Hourly start entry is too far from target time', {
        targetTime: oneHourAgoInSeconds,
        actualTime: hourStartEntry.time,
        difference: Math.abs(hourStartEntry.time - oneHourAgoInSeconds)
      });
    }

    const stats = {
      dailyFees: this.convertToUSD(dailyFees),
      dailySpotFees: this.convertToUSD(dailySpotFees),
      hourlyFees: this.convertToUSD(hourlyFees),
      hourlySpotFees: this.convertToUSD(hourlySpotFees)
    };

    logDeduplicator.info('Final calculated stats', {
      ...stats,
      rawDailyFees: dailyFees,
      rawDailySpotFees: dailySpotFees,
      rawHourlyFees: hourlyFees,
      rawHourlySpotFees: hourlySpotFees
    });

    return stats;
  }

  public async getFeesStats(): Promise<FeesStats> {
    try {
      const statsFromCache = await this.getFeesStatsFromCache();
      if (statsFromCache) {
        logDeduplicator.info('Retrieved cached stats', {
          lastUpdate: this.lastUpdate
        });
        return statsFromCache;
      }

      logDeduplicator.info('No cached stats found, updating...');
      const freshStats = await this.updateFeesStats();
      
      if (!freshStats) {
        throw new FeesError('Failed to get fees stats after update');
      }
      
      logDeduplicator.info('Retrieved fresh stats', {
        lastUpdate: this.lastUpdate
      });
      return freshStats;
    } catch (error) {
      logDeduplicator.error('Error fetching fees stats:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }
}   