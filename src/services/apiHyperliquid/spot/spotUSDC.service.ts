import { BaseApiService } from '../../base/base.api.service';
import { SpotUSDCData } from '../../../types/spotUSDC.types';

export class SpotUSDCService extends BaseApiService {
  constructor() {
    super('https://api.hypurrscan.io');
  }

  /**
   * Récupère les données USDC spot sur Hyperliquid
   */
  public async getSpotUSDCData(): Promise<SpotUSDCData> {
    try {
      console.log('Fetching spot USDC data from API...');
      const response = await this.get('/spotUSDC');
      console.log('Spot USDC data response received, type:', typeof response);
      
      // Vérifier si la réponse est un tableau
      if (Array.isArray(response) && response.length > 0) {
        console.log(`Received array of ${response.length} items, using most recent data`);
        // Trier le tableau par lastUpdate (du plus récent au plus ancien)
        const sortedData = [...response].sort((a, b) => b.lastUpdate - a.lastUpdate);
        // Prendre la première entrée (la plus récente)
        const latestData = sortedData[0];
        
        console.log('Latest data:', latestData);
        return latestData;
      }
      
      // Si l'API ne retourne pas de données valides, utiliser des valeurs par défaut
      console.log('No valid data received from API, using default values');
      return {
        lastUpdate: Date.now(),
        totalSpotUSDC: 0,
        holdersCount: 0,
        "HIP-2": 0
      };
    } catch (error) {
      console.error('Error fetching spot USDC data:', error);
      // En cas d'erreur, retourner des valeurs par défaut
      return {
        lastUpdate: Date.now(),
        totalSpotUSDC: 0,
        holdersCount: 0,
        "HIP-2": 0
      };
    }
  }
} 