import { BaseResponse, TimeRange } from './common.types';

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
    parentAddress?: string;
    relationshipType?: 'parent' | 'child' | 'sibling';
  };
}

export interface FollowerState {
  isFollowing: boolean;
  canFollow: boolean;
  canUnfollow: boolean;
  pendingWithdrawal: boolean;
  withdrawalAmount?: string;
  withdrawalTime?: number;
}

export interface VaultDetails {
  name: string;
  vaultAddress: string;
  leader: string;
  description: string;
  portfolio: [string, VaultPortfolioData][];
  apr: number;
  followerState: FollowerState;
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

export interface VaultDetailsRequest extends TimeRange {
  type: string;
  vaultAddress: string;
  user?: string;
}

export interface VaultDetailsResponse extends BaseResponse {
  data: VaultDetails;
} 