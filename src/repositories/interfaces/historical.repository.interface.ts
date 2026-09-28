import { BaseRepository } from './base.repository.interface';
import { RawLiquidationCreateInput, IngestionStateResponse, HistoricalStats, RawChartBucket } from '../../types/historical.types';
import { Liquidation } from '../../types/liquidations.types';

/** A named time window for the multi-period queries. */
export interface HistoricalStatsWindow {
  key: string;
  since: Date;
}

export interface HistoricalChartWindow extends HistoricalStatsWindow {
  bucketSizeMinutes: number;
}

/**
 * Repository interface for historical liquidation data.
 */
export interface HistoricalLiquidationRepository extends BaseRepository {
  /**
   * Batch insert raw liquidations with skipDuplicates (dedup by tid unique constraint)
   * @returns The number of actually inserted records
   */
  createMany(data: RawLiquidationCreateInput[]): Promise<{ count: number }>;

  /**
   * Get total row count in raw_liquidations table
   */
  count(): Promise<number>;

  /**
   * Upsert the single-row ingestion state watermark
   */
  upsertIngestionState(lastTid: bigint, lastTimeMs: bigint, newCount: number): Promise<void>;

  /**
   * Get current ingestion state (for monitoring)
   */
  getIngestionState(): Promise<IngestionStateResponse | null>;

  /**
   * Get aggregated stats for liquidations since a given date.
   * Uses DB-level aggregation (one statement, one scan) for performance.
   * @param coin Optional coin filter (e.g. "BTC")
   */
  getStats(since: Date, coin?: string): Promise<HistoricalStats>;

  /**
   * `getStats` (no coin filter) for several windows at once, keyed by window.
   */
  getStatsForPeriods(windows: HistoricalStatsWindow[]): Promise<Map<string, HistoricalStats>>;

  /**
   * Get time-bucketed chart data using epoch-based bucketing.
   * Works for arbitrary intervals (5min, 15min, 1h, etc.) on all PostgreSQL versions.
   * @param since Start of the time window
   * @param bucketSizeMinutes Bucket size in minutes (e.g. 5, 15, 60)
   * @param coin Optional coin filter
   */
  getChart(since: Date, bucketSizeMinutes: number, coin?: string): Promise<RawChartBucket[]>;

  /**
   * `getChart` (no coin filter) for several windows at once, each with its own
   * bucket size, keyed by window.
   */
  getChartForPeriods(windows: HistoricalChartWindow[]): Promise<Map<string, RawChartBucket[]>>;

  /**
   * The largest liquidations since `since`, at least `minNotional` USD, one
   * row per liquidation (same dedup as the stats), largest first.
   */
  getTopEvents(since: Date, minNotional: number, limit: number): Promise<Liquidation[]>;
}
