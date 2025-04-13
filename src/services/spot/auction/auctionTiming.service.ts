import { AuctionTimingInfo } from '../../../types/auction.types';
import { HyperliquidSpotDeployClient } from '../../../clients/hyperliquid/spot/spot.deploy.client';
import { AuctionError, InvalidAuctionDataError } from '../../../errors/spot.errors';
import { logger } from '../../../utils/logger';

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
        logger.warn('No spot deploy state data available');
        throw new InvalidAuctionDataError('No spot deploy state data available');
      }

      // L'API retourne directement l'objet avec states et gasAuction
      const gasAuction = response.gasAuction;
      if (!gasAuction) {
        logger.warn('No gas auction data available');
        throw new InvalidAuctionDataError('No gas auction data available');
      }

      const currentStartTime = gasAuction.startTimeSeconds * 1000;
      const currentEndTime = (gasAuction.startTimeSeconds + gasAuction.durationSeconds) * 1000;
      const nextStartTime = currentEndTime + (31 * 3600 * 1000);
      const nextStartGas = gasAuction.endGas ? 
        (Number(gasAuction.endGas) * 2).toString() : 
        "0";

      logger.info('Auction timing retrieved successfully', { 
        currentStartTime,
        currentEndTime,
        nextStartTime,
        startGas: gasAuction.startGas,
        currentGas: gasAuction.currentGas,
        endGas: gasAuction.endGas || "0"
      });
      
      return {
        currentAuction: {
          startTime: currentStartTime,
          endTime: currentEndTime,
          startGas: gasAuction.startGas,
          currentGas: gasAuction.currentGas,
          endGas: gasAuction.endGas || "0"
        },
        nextAuction: {
          startTime: nextStartTime,
          startGas: nextStartGas
        }
      };
    } catch (error) {
      logger.error('Error fetching auction timing:', { error });
      if (error instanceof InvalidAuctionDataError) {
        throw error;
      }
      throw new AuctionError(error instanceof Error ? error.message : 'Failed to fetch auction timing');
    }
  }

  /**
   * Récupère le poids de la requête pour le rate limiting
   */
  public getRequestWeight(): number {
    return HyperliquidSpotDeployClient.getRequestWeight();
  }
}