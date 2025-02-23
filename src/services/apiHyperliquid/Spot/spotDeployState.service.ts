import { BaseApiService } from '../../base/base.api.service';
import { GasAuctionResponse, AuctionTimingInfo } from '../../../types/auction.types';

export class SpotDeployStateApiService extends BaseApiService {
  constructor() {
    super('https://api-ui.hyperliquid.xyz/info');
  }

  async getSpotDeployState(): Promise<GasAuctionResponse | null> {
    try {
      return await this.post<GasAuctionResponse>('', {
        type: "spotDeployState",
        user: "0x0000000000000000000000000000000000000000" // Adresse à confirmer
      });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  public async getAuctionTiming(): Promise<AuctionTimingInfo> {
    const response = await this.post<GasAuctionResponse>('', {
      type: "spotDeployState"
    });

    const { gasAuction } = response;
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
  }
}