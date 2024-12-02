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
    logo?: string;
    price: number;
    marketCap: number;
    volume: number;
    change24h: number;
    liquidity: number;
    supply: number;
}