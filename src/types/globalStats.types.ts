export interface GlobalStats {
  totalVolume: number;
  dailyVolume: number;
  nUsers: number;
}

export interface GlobalStatsResponse {
  totalVolume: number;
  dailyVolume: number;
  nUsers: number;
}

export interface DashboardGlobalStats {
  numberOfUsers: number;
  dailyVolume: number;
  bridgedUsdc: number;
  totalHypeStake: number;
}

export interface SpotGlobalStats {
  totalVolume24h: number;
  totalPairs: number;
  totalMarketCap: number;
  totalSpotUSDC: number;
  totalHIP2: number;
}

export interface PerpGlobalStats {
  totalOpenInterest: number;
  totalVolume24h: number;
  totalPairs: number;
} 