import { BaseResponse } from './common.types';


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
}

export type ValidatorSummaries = ValidatorSummary[];

export interface ValidatorSummariesResponse extends BaseResponse {
  data: ValidatorSummaries;
}

export interface TrendingValidator {
  name: string;
  stake: number;
  apr: number;
}

export interface ValidatorDetails {
  name: string;
  stake: number;
  apr: number;
  commission: number;
  uptime: number;
}

export interface TrendingValidatorsResponse extends BaseResponse {
  data: TrendingValidator[];
}

export interface ValidatorDetailsResponse extends BaseResponse {
  data: ValidatorDetails[];
} 