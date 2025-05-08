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
  name?: string;
  addedAt: Date;
}

export interface UserWalletResponse {
  id: number;
  userId: number;
  walletId: number;
  name?: string;
  addedAt: Date;
  Wallet: WalletResponse;
}

export interface WalletCreateInput {
  address: string;
  name?: string;
}

export interface WalletUpdateInput {
  name?: string;
}

export interface WalletQueryParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
  userId?: number;
}

export interface UserWalletCreateInput {
  userId: number;
  walletId: number;
  name?: string;
}
