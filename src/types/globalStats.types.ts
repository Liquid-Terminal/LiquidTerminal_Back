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