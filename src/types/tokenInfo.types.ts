export interface TokenHolder {
  address: string;
  balance: string;
}

export interface TokenInfoResponse {
  name: string;
  maxSupply: string;
  totalSupply: string;
  circulatingSupply: string;
  szDecimals: number;
  weiDecimals: number;
  midPx: string;
  markPx: string;
  prevDayPx: string;
  deployer: string;
  deployGas: string;
  deployTime: string;
  seededUsdc: string;
  genesis: {
    userBalances: [string, string][];  // Format [address, balance][]
    existingTokenBalances: any[];
  };
  nonCirculatingUserBalances: [string, string][];
}

export interface FormattedTokenInfo extends Omit<TokenInfoResponse, 'genesis' | 'nonCirculatingUserBalances'> {
  holders: TokenHolder[];
  nonCirculatingHolders: TokenHolder[];
} 