import { BaseResponse } from './common.types';

// Types de base pour les validateurs
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
  unjailableAfter: number | null;
  stats: [string, { predictedApr: string; uptimeFraction: string }][];
}

export type ValidatorSummaries = ValidatorSummary[];

// Types pour les réponses API
export interface ValidatorSummariesResponse extends BaseResponse {
  data: ValidatorSummaries;
}

export interface TrendingValidatorsResponse extends BaseResponse {
  data: TrendingValidator[];
}

export interface ValidatorDetailsResponse extends BaseResponse {
  data: ValidatorDetails[];
}

// Types pour les données formatées
export interface TrendingValidator {
  name: string;
  stake: number;
  apr: number;
  commission: number;
  uptime: number;
  isActive: boolean;
  nRecentBlocks: number;
}

export interface ValidatorDetails {
  name: string;
  stake: number;
  apr: number;
  commission: number;
  uptime: number;
  isActive: boolean;
  nRecentBlocks: number;
}

export interface ValidatorStats {
  predictedApr: string;
  uptimeFraction: string;
} 