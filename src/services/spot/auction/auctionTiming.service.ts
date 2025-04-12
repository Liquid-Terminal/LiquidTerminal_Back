import { GasAuctionResponse, AuctionTimingInfo } from '../../../types/auction.types';
import { HyperliquidSpotDeployClient } from '../../../clients/hyperliquid/spot/spot.deploy.client';

export class SpotDeployStateApiService {
  private hyperliquidClient: HyperliquidSpotDeployClient;

  constructor() {
    this.hyperliquidClient = HyperliquidSpotDeployClient.getInstance();
  }

  /**
   * Récupère les informations de timing des enchères
   */
  public async getAuctionTiming(): Promise<AuctionTimingInfo> {
    try {
      const response = await this.hyperliquidClient.getSpotDeployState();
      if (!response) {
        throw new Error('No spot deploy state data available');
      }

      const { gasAuction } = response.data;
      const currentStartTime = gasAuction.startTimeSeconds * 1000;
      const currentEndTime = (gasAuction.startTimeSeconds + gasAuction.durationSeconds) * 1000;
      const nextStartTime = currentEndTime + (31 * 3600 * 1000);
      const nextStartGas = gasAuction.endGas ? 
        (Number(gasAuction.endGas) * 2).toString() : 
        "0";

      return {
        currentAuction: {
          startTime: currentStartTime,
          endTime: currentEndTime,
          startGas: gasAuction.startGas,
          endGas: gasAuction.endGas || "0"
        },
        nextAuction: {
          startTime: nextStartTime,
          startGas: nextStartGas
        }
      };
    } catch (error) {
      console.error('Error fetching auction timing:', error);
      throw error;
    }
  }

  /**
   * Récupère le poids de la requête pour le rate limiting
   */
  public getRequestWeight(): number {
    return HyperliquidSpotDeployClient.getRequestWeight();
  }
}