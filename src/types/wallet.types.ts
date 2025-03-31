import { BaseResponse, TokenAmount } from './common.types';

export interface WalletHolding {
  coin: string;
  token: number;
  hold: string;
  total: string;
  entryNtl: string;
}

export interface WalletState {
  address: string;
  holdings: WalletHolding[];
}

export interface WalletStateResponse extends BaseResponse {
  data: WalletState;
}

export interface WalletWatchlist {
  id: number;
  userId: string;
  walletAddress: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletWatchlistResponse extends BaseResponse {
  data: WalletWatchlist[];
}

export interface PerpPosition {
  coin: string;
  cumFunding: {
    allTime: string;
    sinceChange: string;
    sinceOpen: string;
  };
  entryPx: string;
  leverage: {
    rawUsd: string;
    type: 'isolated' | 'cross';
    value: number;
  };
  liquidationPx: string;
  marginUsed: string;
  maxLeverage: number;
  positionValue: string;
  returnOnEquity: string;
  szi: string;
  unrealizedPnl: string;
}

export interface PerpPositionWithType {
  position: PerpPosition;
  type: 'oneWay';
}

export interface PerpMarginSummary {
  accountValue: string;
  totalMarginUsed: string;
  totalNtlPos: string;
  totalRawUsd: string;
}

export interface PerpAccountState {
  assetPositions: PerpPositionWithType[];
  crossMaintenanceMarginUsed: string;
  crossMarginSummary: PerpMarginSummary;
  marginSummary: PerpMarginSummary;
  time: number;
  withdrawable: string;
}

export interface PerpAccountStateResponse extends BaseResponse {
  data: PerpAccountState;
}

export interface OrderAction {
  type: string;
  orders?: Array<{
    a: number;
    b: boolean;
    p: string;
    s: string;
    r: boolean;
    t: {
      limit: {
        tif: string;
      };
    };
  }>;
  amount?: string;
  token?: string;
  destination?: string;
  wei?: string;
}

export interface UserTransaction {
  time: number;
  user: string;
  action: OrderAction;
  grouping: string;
  block: number;
  error: string | null;
  hash: string;
}

export interface NonFundingLedgerUpdate {
  delta: {
    coin?: string;
    type: string;
    usdc?: string;
    amount?: string;
    token?: string;
    user?: string;
    destination?: string;
    fee?: string;
    nativeTokenFee?: string;
    usdcValue?: string;
  };
  hash: string;
  time: number;
}

export interface UserTransactionsResponse {
  type: string;
  txs: UserTransaction[];
}

export interface FormattedUserTransaction {
  hash: string;
  method: string;
  age: string;
  from: string;
  to: string;
  amount: string;
  token: string;
  price?: string;
  total?: string;
}

export interface UserFill {
  coin: string;
  px: string;
  sz: string;
  side: string;
  time: number;
  startPosition: string;
  cloid: string;
  closedPnl: string;
  crossed: boolean;
  dir: string;
  fee: string;
  feeToken: string;
  hash: string;
  oid: number;
  tid: number;
}

export type UserFillsResponse = UserFill[]; 