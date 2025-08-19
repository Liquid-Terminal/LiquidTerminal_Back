import { BasePagination } from './common.types';

export interface WindowPerformance {
  pnl: string;
  roi: string;
  vlm: string;
}

export interface LeaderboardRow {
  ethAddress: string;
  accountValue: string;
  windowPerformances: [string, WindowPerformance][];
  prize: number;
  displayName: string;
}

export interface LeaderboardResponse {
  leaderboardRows: LeaderboardRow[];
}

export interface ProcessedLeaderboardEntry {
  ethAddress: string;
  accountValue: number;
  displayName: string;
  prize: number;
  day: WindowPerformance;
  week: WindowPerformance;
  month: WindowPerformance;
  allTime: WindowPerformance;
}

export interface LeaderboardQueryParams {
  timeline?: 'day' | 'week' | 'month' | 'allTime';
  sortBy?: 'pnl' | 'roi' | 'vlm';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface PaginatedLeaderboardResponse {
  data: ProcessedLeaderboardEntry[];
  pagination: BasePagination;
}

export class LeaderboardError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code: string = 'LEADERBOARD_ERROR'
  ) {
    super(message);
    this.name = 'LeaderboardError';
  }
}

export class LeaderboardNotFoundError extends LeaderboardError {
  constructor(message: string = 'Leaderboard data not found') {
    super(message, 404, 'LEADERBOARD_NOT_FOUND');
  }
}

export class LeaderboardValidationError extends LeaderboardError {
  constructor(message: string = 'Invalid leaderboard parameters') {
    super(message, 400, 'LEADERBOARD_VALIDATION_ERROR');
  }
} 