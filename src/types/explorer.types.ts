import { BaseResponse } from './common.types';

export interface BlockDetailsRequest {
  type: string;
  height: number;
}

export interface TxDetailsRequest {
  type: string;
  hash: string;
}

export interface BlockDetails {
  height: number;
  hash: string;
  timestamp: number;
  proposer: string;
  txs: string[];
  gasUsed: string;
  gasLimit: string;
  rewards: string;
  numTxs: number;
  // Autres propriétés possibles selon la réponse de l'API
}

export interface TxDetails {
  hash: string;
  height: number;
  timestamp: number;
  from: string;
  to?: string;
  success: boolean;
  gasUsed: string;
  gasPrice: string;
  gasLimit: string;
  nonce: number;
  data: string;
  value: string;
  type: string;
  // Autres propriétés possibles selon la réponse de l'API
}

export interface BlockDetailsResponse extends BaseResponse {
  data: BlockDetails;
}

export interface TxDetailsResponse extends BaseResponse {
  data: TxDetails;
} 