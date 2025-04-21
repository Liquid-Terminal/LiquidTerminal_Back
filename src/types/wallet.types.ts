import { BaseResponse } from './common.types';

export interface WalletWatchlist {
  id: number;
  userId: string;
  walletAddress: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletWatchlistResponse extends BaseResponse {
  data: WalletWatchlist[];
}

export interface WalletResponse {
  id: number;
  address: string;
  userId: number;
  addedAt: Date;
}

export interface WalletCreateInput {
  address: string;
  privyUserId: string;
}

export interface WalletUpdateInput {
  address?: string;
}

export interface WalletQueryParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
  userId?: number;
}
