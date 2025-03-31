import { BaseResponse } from './common.types';

export type AuctionInfo = {
  time: number;
  deployer: string;
  name: string;
  deployGas: string;
  tokenId?: string; // Identifiant du token, optionnel car peut ne pas être disponible pour tous les tokens
}

export interface TokenDetailsResponse extends BaseResponse {
  data: {
    deployTime: string;
    deployer: string;
    name: string;
    deployGas: string;
  };
}

export interface AuctionState {
  startTime: number;
  endTime: number;
  startGas: string;
  currentGas: string | null;
  endGas: string;
  status: 'pending' | 'active' | 'completed';
}

export interface GasAuctionResponse extends BaseResponse {
  data: {
    states: AuctionState[];
    gasAuction: {
      startTimeSeconds: number;
      durationSeconds: number;
      startGas: string;
      currentGas: string | null;
      endGas: string;
    };
  };
}

export interface AuctionTimingInfo {
  currentAuction: {
    startTime: number;
    endTime: number;
    startGas: string;
    endGas: string;
  };
  nextAuction: {
    startTime: number;
    startGas: string;
  };
} 