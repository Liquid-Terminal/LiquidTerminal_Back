export type AuctionInfo = {
  time: number;
  deployer: string;
  name: string;
  deployGas: string;
  tokenId?: string; // Identifiant du token, optionnel car peut ne pas être disponible pour tous les tokens
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

export interface AuctionInfoWithCurrency extends AuctionInfo {
  currency: 'USDC' | 'HYPE';
  deployGasAbs: string; // Montant absolu (sans le signe négatif pour HYPE)
}

export interface SplitAuctionsResponse {
  usdcAuctions: AuctionInfoWithCurrency[];
  hypeAuctions: AuctionInfoWithCurrency[];
  splitTimestamp: number; // Le timestamp de transition
  totalUsdcSpent: string; // Total USDC dépensé
  totalHypeSpent: string; // Total HYPE dépensé
} 