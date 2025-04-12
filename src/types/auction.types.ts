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

// Structure réelle de la réponse de l'API
export interface GasAuctionResponse {
  states: AuctionState[];
  gasAuction: {
    startTimeSeconds: number;
    durationSeconds: number;
    startGas: string;
    currentGas: string | null;
    endGas: string | null;
  };
}

export interface AuctionTimingInfo {
  currentAuction: {
    startTime: number;
    endTime: number;
    startGas: string;
    currentGas: string | null;
    endGas: string;
  };
  nextAuction: {
    startTime: number;
    startGas: string;
  };
} 