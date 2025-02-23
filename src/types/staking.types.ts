export interface Delegation {
  validator: string;
  amount: string;
  lockedUntilTimestamp: number;
}

export interface DelegationsResponse {
  delegations: Delegation[];
}

export interface DelegatorSummary {
  delegated: string;
  undelegated: string;
  totalPendingWithdrawal: string;
  nPendingWithdrawals: number;
}

export interface DelegationAction {
  validator: string;
  amount: string;
  isUndelegate: boolean;
}

export interface DelegationDelta {
  delegate: DelegationAction;
}

export interface DelegatorHistoryEntry {
  time: number;
  hash: string;
  delta: DelegationDelta;
}

export type DelegatorHistory = DelegatorHistoryEntry[];

export interface DelegatorReward {
  time: number;
  source: 'delegation' | 'commission';
  totalAmount: string;
}

export type DelegatorRewards = DelegatorReward[];

export interface ValidatorStats {
  uptimeFraction: string;
  predictedApr: string;
  nSamples: number;
}

export interface ValidatorSummary {
  validator: string;
  commission: string;
  description: string;
  isActive: boolean;
  isJailed: boolean;
  nRecentBlocks: number;
  name: string;
  signer: string;
  stake: number;
  stats: [string, ValidatorStats][];
  unjailableAfter: number | null;
}

export type ValidatorSummaries = ValidatorSummary[]; 