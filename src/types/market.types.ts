import { BaseResponse, TokenAmount } from './common.types';

export interface Token {
    name: string;
    szDecimals: number;
    weiDecimals: number;
    index: number;
    tokenId: string;
    isCanonical: boolean;
    evmContract: string | null;
    fullName: string | null;
}

export interface Market {
    name: string;
    tokens: number[];
    index: number;
    isCanonical: boolean;
}

export interface SpotContext {
    tokens: Token[];
    universe: Market[];
}

export interface AssetContext {
    dayNtlVlm: string;
    markPx: string;
    midPx: string;
    prevDayPx: string;
    circulatingSupply: string;
    coin: string;
}

export interface MarketData {
    name: string;
    logo: string | null;
    price: number;
    marketCap: number;
    volume: number;
    change24h: number;
    liquidity: number;
    supply: number;
}

export interface TokenDetails {
    name: string;
    img: string;
    desc: string;
}

// Types pour les marchés perpétuels
export interface PerpMarket {
    name: string;
    szDecimals: number;
    maxLeverage: number;
    onlyIsolated?: boolean;
}

export interface PerpAssetContext {
    dayNtlVlm: string;
    funding: string;
    impactPxs: string[];
    markPx: string;
    midPx: string;
    openInterest: string;
    oraclePx: string;
    premium: string;
    prevDayPx: string;
}

export interface PerpMarketData {
    name: string;
    price: number;
    change24h: number;
    volume: number;
    openInterest: number;
    funding: number;
    maxLeverage: number;
    onlyIsolated: boolean;
}

// Types pour USDC Spot
export interface SpotUSDCData {
    lastUpdate: number;
    totalSpotUSDC: number;
    holdersCount: number;
    "HIP-2": number;
}

export interface SpotUSDCResponse extends BaseResponse {
    data: SpotUSDCData;
}

// Types pour les statistiques globales
export interface GlobalStats {
    totalVolume: number;
    dailyVolume: number;
    nUsers: number;
}

export interface GlobalStatsResponse extends BaseResponse {
    data: GlobalStats;
}

export interface DashboardGlobalStats {
    numberOfUsers: number;
    dailyVolume: number;
    bridgedUsdc: number;
    totalHypeStake: number;
}

export interface SpotGlobalStats {
    totalVolume24h: number;
    totalPairs: number;
    totalMarketCap: number;
    totalSpotUSDC: number;
    totalHIP2: number;
}

export interface PerpGlobalStats {
    totalOpenInterest: number;
    totalVolume24h: number;
    totalPairs: number;
}

// Types pour USDC Bridged
export interface UsdAmount {
    peggedUSD: number;
}

export interface BridgedUsdcData {
    date: string;
    totalCirculating: UsdAmount;
    totalCirculatingUSD: UsdAmount;
    totalBridgedToUSD: UsdAmount;
    totalUnreleased?: UsdAmount;
    totalMintedUSD?: UsdAmount;
}

export interface BridgedUsdcResponse extends BaseResponse {
    data: BridgedUsdcData[];
}

// Types pour les informations des tokens
export interface TokenHolder {
    address: string;
    balance: string;
}

export interface ExistingTokenBalance {
    token: string;
    balance: string;
    decimals: number;
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
        userBalances: [string, string][];
        existingTokenBalances: ExistingTokenBalance[];
    };
    nonCirculatingUserBalances: [string, string][];
}

export interface FormattedTokenInfo extends Omit<TokenInfoResponse, 'genesis' | 'nonCirculatingUserBalances'> {
    holders: TokenHolder[];
    nonCirculatingHolders: TokenHolder[];
}

export interface TokenInfoResponseWrapper extends BaseResponse {
    data: TokenInfoResponse;
}

export interface SortIndices {
  volume: number[];
  marketCap: number[];
  change24h: number[];
}

export interface PerpSortIndices {
  volume: number[];
  openInterest: number[];
  change24h: number[];
}

export interface WebSocketMarketData {
  spot: {
    all: MarketData[];
    sortIndices: SortIndices;
  };
  perp: {
    all: PerpMarketData[];
    sortIndices: PerpSortIndices;
  };
  error?: string;
}

export interface MarketQueryParams {
  sortBy?: 'volume' | 'marketCap' | 'change24h';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  page?: number;
  token?: string;
  pair?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PerpMarketQueryParams {
  sortBy?: 'volume' | 'openInterest' | 'change24h';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  page?: number;
  token?: string;
  pair?: string;
}