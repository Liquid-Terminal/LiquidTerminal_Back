export interface BridgedUsdcData {
  date: string;
  totalCirculating: {
    peggedUSD: number;
  };
  totalCirculatingUSD: {
    peggedUSD: number;
  };
  totalBridgedToUSD: {
    peggedUSD: number;
  };
  totalUnreleased?: {
    peggedUSD: number;
  };
  totalMintedUSD?: {
    peggedUSD: number;
  };
}

export interface BridgedUsdcResponse {
  data: BridgedUsdcData[];
} 