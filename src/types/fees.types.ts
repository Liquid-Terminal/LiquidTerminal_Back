import { BaseResponse } from './common.types';

export interface FeeData {
  time: number;
  total_fees: number;
  total_spot_fees: number;
}

export interface FeesStats {
  dailyFees: number;
  dailySpotFees: number;
  hourlyFees: number;
  hourlySpotFees: number;
}

export interface FeesResponse extends BaseResponse {
  data: FeesStats;
}

export class FeesError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'FEES_ERROR'
  ) {
    super(message);
    this.name = 'FeesError';
  }
}

export class FeesTimeoutError extends FeesError {
  constructor(message: string = 'Fees request timed out') {
    super(message, 504, 'FEES_TIMEOUT');
    this.name = 'FeesTimeoutError';
  }
} 