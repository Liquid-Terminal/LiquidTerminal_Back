export type AuctionInfo = {
  time: number;
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