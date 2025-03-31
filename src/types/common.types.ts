export interface BaseResponse {
  success: boolean;
  error?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface TimeRange {
  startTime?: number;
  endTime?: number;
}

export interface Address {
  address: string;
}

export interface TokenAmount {
  amount: string;
  decimals: number;
}

export interface SocialLinks {
  twitter?: string;
  discord?: string;
  telegram?: string;
  website?: string;
  github?: string;
  farcaster?: string;
} 