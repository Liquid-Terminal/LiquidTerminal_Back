export type AuctionInfo = {
  time: number;
  deployer: string;
  name: string;
  deployGas: string;
  tokenId?: string; // Identifiant du token, optionnel car peut ne pas être disponible pour tous les tokens
}

export interface TokenDetailsResponse {
  deployTime: string;
  deployer: string;
  name: string;
  deployGas: string;
}

export interface GasAuctionResponse {
  states: any[];
  gasAuction: {
    startTimeSeconds: number;
    durationSeconds: number;
    startGas: string;
    currentGas: string | null;
    endGas: string;
  }
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