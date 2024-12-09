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