import { BaseApiService } from '../../base/base.api.service';
import { BlockDetails, BlockDetailsRequest, TxDetails, TxDetailsRequest } from '../../../types/explorer.types';

export class ExplorerService extends BaseApiService {
  constructor() {
    super('https://rpc.hyperliquid.xyz/explorer');
  }

  /**
   * Récupère les détails d'un bloc spécifique
   * @param height Hauteur du bloc
   */
  public async getBlockDetails(height: number): Promise<BlockDetails> {
    try {
      const request: BlockDetailsRequest = {
        type: "blockDetails",
        height: height
      };

      console.log(`Fetching details for block #${height}`);
      const response = await this.post('', request) as BlockDetails;
      return response;
    } catch (error) {
      console.error(`Error fetching details for block #${height}:`, error);
      throw this.handleError(error);
    }
  }

  /**
   * Récupère les détails d'une transaction spécifique
   * @param hash Hash de la transaction
   */
  public async getTxDetails(hash: string): Promise<TxDetails> {
    try {
      const request: TxDetailsRequest = {
        type: "txDetails",
        hash: hash
      };

      console.log(`Fetching details for transaction ${hash}`);
      const response = await this.post('', request) as TxDetails;
      return response;
    } catch (error) {
      console.error(`Error fetching details for transaction ${hash}:`, error);
      throw this.handleError(error);
    }
  }
} 