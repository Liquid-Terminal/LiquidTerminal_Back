import { BaseResponse } from './common.types';

export interface WalletHolding {
  coin: string;
  token: number;
  hold: string;
  total: string;
  entryNtl: string;
}

export interface WalletState {
  address: string;
  holdings: WalletHolding[];
}

export interface WalletStateResponse extends BaseResponse {
  data: WalletState;
}

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
