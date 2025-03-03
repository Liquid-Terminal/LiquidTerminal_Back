export interface VaultPortfolioData {
  accountValueHistory: [number, string][];
  pnlHistory: [number, string][];
  vlm: string;
}

export interface VaultPortfolio {
  day: VaultPortfolioData;
  week: VaultPortfolioData;
  month: VaultPortfolioData;
  allTime: VaultPortfolioData;
  perpDay: VaultPortfolioData;
  perpWeek: VaultPortfolioData;
  perpMonth: VaultPortfolioData;
  perpAllTime: VaultPortfolioData;
}

export interface VaultFollower {
  user: string;
  vaultEquity: string;
  pnl: string;
  allTimePnl: string;
  daysFollowing: number;
  vaultEntryTime: number;
  lockupUntil: number;
}

export interface VaultRelationship {
  type: string;
  data: {
    childAddresses?: string[];
    // Autres propriétés possibles selon le type de relation
  };
}

export interface VaultDetails {
  name: string;
  vaultAddress: string;
  leader: string;
  description: string;
  portfolio: [string, VaultPortfolioData][];
  apr: number;
  followerState: any;
  leaderFraction: number;
  leaderCommission: number;
  followers: VaultFollower[];
  maxDistributable: number;
  maxWithdrawable: number;
  isClosed: boolean;
  relationship: VaultRelationship;
  allowDeposits: boolean;
  alwaysCloseOnWithdraw: boolean;
}

export interface VaultDetailsRequest {
  type: string;
  vaultAddress: string;
  user?: string;
} 