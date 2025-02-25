import { TokenInfoService } from '../spot/tokenInfo.service';
import { SpotDeployStateApiService } from '../spot/spotDeployState.service';
import { SpotAssetContextService } from '../spot/spotAssetContext.service';
import { AuctionInfo, AuctionTimingInfo } from '../../../types/auction.types';
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';

export class AuctionPageService {
  private readonly CACHE_FILE = path.join(process.cwd(), 'cache', 'auctions.json');
  private readonly UPDATE_INTERVAL = 6 * 60 * 60 * 1000; // 6 heures au lieu de 31
  private readonly BATCH_SIZE = 3; // Réduit à 3 au lieu de 5 pour diminuer la charge
  private readonly DELAY_BETWEEN_BATCHES = 3000; // Augmenté à 3 secondes au lieu de 2
  private readonly DELAY_BETWEEN_TOKENS = 1000; // 1 seconde entre chaque token
  private readonly HYPURRSCAN_API_URL = 'https://api.hypurrscan.io/pastAuctions';

  private auctionsCache: AuctionInfo[] | null = null;
  private lastUpdateTime = 0;
  private isUpdating = false;
  private updateTimeout: NodeJS.Timeout | null = null;

  constructor(
    private tokenInfoService: TokenInfoService,
    private spotDeployStateApi: SpotDeployStateApiService,
    private spotAssetContextService: SpotAssetContextService
  ) {
    fs.mkdir(path.dirname(this.CACHE_FILE), { recursive: true }).catch(console.error);
    this.loadCacheFromDisk().catch(console.error);
    this.setupAutomaticUpdate();
  }

  private async loadCacheFromDisk(): Promise<void> {
    try {
      const data = await fs.readFile(this.CACHE_FILE, 'utf-8');
      const cached = JSON.parse(data);
      this.auctionsCache = cached.auctions;
      this.lastUpdateTime = cached.lastUpdateTime;
      console.log(`Loaded cache from disk with ${this.auctionsCache?.length || 0} auctions, last updated at ${new Date(this.lastUpdateTime).toISOString()}`);
    } catch (error) {
      console.log('No cache file found or invalid cache, starting fresh');
      this.auctionsCache = null;
      this.lastUpdateTime = 0;
    }
  }

  private async saveCacheToDisk(): Promise<void> {
    try {
      await fs.writeFile(this.CACHE_FILE, JSON.stringify({
        auctions: this.auctionsCache,
        lastUpdateTime: this.lastUpdateTime
      }));
      console.log(`Cache saved to disk with ${this.auctionsCache?.length || 0} auctions`);
    } catch (error) {
      console.error('Error saving cache to disk:', error);
    }
  }

  private async setupAutomaticUpdate(): Promise<void> {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    
    const nextUpdateTime = new Date(this.lastUpdateTime + this.UPDATE_INTERVAL);
    console.log(`Next automatic update scheduled for ${nextUpdateTime.toISOString()}`);
    
    this.updateTimeout = setTimeout(async () => {
      await this.updateCache();
      this.setupAutomaticUpdate();
    }, this.UPDATE_INTERVAL);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async processBatch(tokenIds: string[]): Promise<AuctionInfo[]> {
    const results: AuctionInfo[] = [];
    
    for (const tokenId of tokenIds) {
      try {
        console.log(`Fetching auction details for token ${tokenId}`);
        const details = await this.tokenInfoService.getTokenAuctionDetails(tokenId);
        if (details) {
          // Ajouter le tokenId à l'objet AuctionInfo et s'assurer qu'il est en minuscules pour la cohérence
          const auctionInfo: AuctionInfo = {
            ...details,
            tokenId: tokenId.toLowerCase() // Stocker le tokenId en minuscules pour la cohérence
          };
          console.log(`Successfully fetched auction details for token ${tokenId} (${details.name})`);
          results.push(auctionInfo);
          // Commenté pour éviter les erreurs de base de données
          // await this.saveAuctionToDatabase(tokenId, details);
        } else {
          console.warn(`No auction details found for token ${tokenId}`);
        }
        // Ajouter un délai entre chaque token pour éviter de surcharger l'API
        await this.delay(this.DELAY_BETWEEN_TOKENS);
      } catch (error) {
        console.error(`Error fetching token ${tokenId}:`, error);
      }
    }
    return results;
  }

  public async getAllAuctions(): Promise<AuctionInfo[]> {
    if (!this.auctionsCache && !this.isUpdating) {
      console.log('No cache available, initiating cache update');
      await this.updateCache();
    }
    return this.auctionsCache || [];
  }

  public async getAuctionTiming(): Promise<AuctionTimingInfo> {
    return this.spotDeployStateApi.getAuctionTiming();
  }

  public async forceUpdate(): Promise<void> {
    console.log('Force update requested');
    await this.updateCache();
    await this.setupAutomaticUpdate();
  }

  public async getCacheStatus(): Promise<{
    lastUpdateTime: number;
    lastUpdateTimeFormatted: string;
    auctionsCount: number;
    nextUpdateTime: number;
    nextUpdateTimeFormatted: string;
    isUpdating: boolean;
  }> {
    const nextUpdateTime = this.lastUpdateTime + this.UPDATE_INTERVAL;
    return {
      lastUpdateTime: this.lastUpdateTime,
      lastUpdateTimeFormatted: new Date(this.lastUpdateTime).toISOString(),
      auctionsCount: this.auctionsCache?.length || 0,
      nextUpdateTime,
      nextUpdateTimeFormatted: new Date(nextUpdateTime).toISOString(),
      isUpdating: this.isUpdating
    };
  }

  /**
   * Récupère les enchères passées depuis l'API hypurrscan.io
   */
  private async fetchPastAuctionsFromHypurrscan(): Promise<AuctionInfo[]> {
    try {
      console.log('Fetching past auctions from hypurrscan.io API...');
      const response = await fetch(this.HYPURRSCAN_API_URL, {
        method: 'GET',
        headers: {
          'accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }

      const data = await response.json() as any[];
      console.log(`Retrieved ${data.length} past auctions from hypurrscan.io`);

      // Analyser les données pour comprendre leur structure
      const sampleData = data.slice(0, 3);
      console.log('Sample data from hypurrscan.io:', JSON.stringify(sampleData, null, 2));

      // Convertir les données au format AuctionInfo
      const auctions = data.map(auction => {
        // Utiliser le nom du token comme identifiant si tokenId n'est pas disponible
        const name = auction.name || auction.ticker || 'Unknown Token';
        
        // Créer un objet AuctionInfo
        const auctionInfo: AuctionInfo = {
          time: new Date(auction.time).getTime(), // L'API hypurrscan.io utilise 'time' et non 'deployTime'
          deployer: auction.deployer || 'unknown',
          name: name,
          deployGas: auction.deployGas || '0',
          // Utiliser le nom du token comme tokenId si aucun tokenId n'est fourni
          tokenId: name.toLowerCase() // Utiliser le nom en minuscules comme identifiant
        };
        
        return auctionInfo;
      });
      
      // Analyser les résultats
      const uniqueNames = new Set(auctions.map(a => a.name));
      console.log(`Processed ${auctions.length} auctions with ${uniqueNames.size} unique token names`);
      
      return auctions;
    } catch (error) {
      console.error('Error fetching past auctions from hypurrscan.io:', error);
      return [];
    }
  }

  /**
   * Fusionne les auctions existantes avec les nouvelles auctions
   */
  private mergeAuctions(existingAuctions: AuctionInfo[], newAuctions: AuctionInfo[]): AuctionInfo[] {
    // Créer un Map des auctions existantes par nom et par tokenId pour une recherche rapide
    const auctionMap = new Map<string, AuctionInfo>();
    
    // Ajouter les auctions existantes au Map
    existingAuctions.forEach(auction => {
      // Utiliser à la fois le nom et le tokenId comme clés pour éviter les doublons
      if (auction.tokenId && typeof auction.tokenId === 'string') {
        auctionMap.set(auction.tokenId.toLowerCase(), auction);
      }
      auctionMap.set(`name:${auction.name.toLowerCase()}`, auction);
    });
    
    // Ajouter les nouvelles auctions si elles n'existent pas déjà
    let addedCount = 0;
    newAuctions.forEach(auction => {
      // Vérifier si l'auction existe déjà par tokenId ou par nom
      const existsByTokenId = auction.tokenId && 
                             typeof auction.tokenId === 'string' && 
                             auctionMap.has(auction.tokenId.toLowerCase());
      const existsByName = auctionMap.has(`name:${auction.name.toLowerCase()}`);
      
      if (!existsByTokenId && !existsByName) {
        // Ajouter l'auction avec les deux clés
        if (auction.tokenId && typeof auction.tokenId === 'string') {
          auctionMap.set(auction.tokenId.toLowerCase(), auction);
        }
        auctionMap.set(`name:${auction.name.toLowerCase()}`, auction);
        addedCount++;
        console.log(`Added new auction for token: ${auction.name} (${auction.tokenId || 'no ID'})`);
      }
    });
    
    console.log(`Added ${addedCount} new auctions from external source`);
    
    // Convertir le Map en tableau en préservant les auctions uniques
    // Utiliser un Set pour suivre les auctions déjà ajoutées
    const uniqueAuctions = new Set<string>();
    const result: AuctionInfo[] = [];
    
    for (const auction of auctionMap.values()) {
      // Créer une clé unique basée sur la combinaison du nom et du tokenId
      const uniqueKey = auction.tokenId ? 
        `${auction.name.toLowerCase()}_${auction.tokenId.toLowerCase()}` : 
        auction.name.toLowerCase();
      
      // N'ajouter l'auction que si elle n'a pas déjà été ajoutée
      if (!uniqueAuctions.has(uniqueKey)) {
        uniqueAuctions.add(uniqueKey);
        result.push(auction);
      }
    }
    
    return result;
  }

  private async updateCache(): Promise<void> {
    if (this.isUpdating) {
      console.log('Cache update already in progress, skipping');
      return;
    }
    
    try {
      this.isUpdating = true;
      console.log('Starting auction cache update...');
      
      // Partir du cache existant s'il existe
      let currentAuctions: AuctionInfo[] = this.auctionsCache || [];
      console.log(`Starting with ${currentAuctions.length} auctions from existing cache`);
      
      // Récupérer les tokenIds directement depuis spotAssetContextService
      const tokenIds = await this.spotAssetContextService.getTokenIds();
      console.log(`Found ${tokenIds.length} tokens to process from Hyperliquid API`);
      
      // Filtrer les tokenIds qui ne sont pas déjà dans le cache
      const existingTokenIds = new Set(currentAuctions
        .filter(auction => !!auction.tokenId)
        .map(auction => (auction.tokenId as string).toLowerCase()));
      
      const newTokenIds = tokenIds.filter(tokenId => !existingTokenIds.has(tokenId.toLowerCase()));
      console.log(`Found ${newTokenIds.length} new tokens to process that are not in cache`);
      
      // Traiter uniquement les nouveaux tokens par batch
      if (newTokenIds.length > 0) {
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < newTokenIds.length; i += this.BATCH_SIZE) {
          const batch = newTokenIds.slice(i, i + this.BATCH_SIZE);
          console.log(`Processing batch ${Math.floor(i/this.BATCH_SIZE) + 1}/${Math.ceil(newTokenIds.length/this.BATCH_SIZE)} (${batch.join(', ')})`);
          
          try {
            const batchResults = await this.processBatch(batch);
            currentAuctions.push(...batchResults);
            successCount += batchResults.length;
            console.log(`Batch processed successfully, got ${batchResults.length} results`);
          } catch (error) {
            console.error('Error processing batch:', error);
            errorCount += batch.length;
          }
          
          if (i + this.BATCH_SIZE < newTokenIds.length) {
            console.log(`Waiting ${this.DELAY_BETWEEN_BATCHES}ms before processing next batch`);
            await this.delay(this.DELAY_BETWEEN_BATCHES);
          }
        }
        
        console.log(`Hyperliquid API auction fetch completed: ${successCount} successful, ${errorCount} failed`);
      } else {
        console.log('No new tokens to process from Hyperliquid API');
      }
      
      // Récupérer les enchères passées depuis hypurrscan.io pour compléter les données manquantes
      console.log('Fetching past auctions from hypurrscan.io to complete missing data...');
      const pastAuctions = await this.fetchPastAuctionsFromHypurrscan();
      console.log(`Retrieved ${pastAuctions.length} past auctions from hypurrscan.io`);
      
      // Analyser les données récupérées
      const pastAuctionNames = new Set(pastAuctions.map(a => a.name.toLowerCase()));
      const currentAuctionNames = new Set(currentAuctions.map(a => a.name.toLowerCase()));
      
      const uniqueInPastAuctions = [...pastAuctionNames].filter(name => !currentAuctionNames.has(name));
      console.log(`Found ${uniqueInPastAuctions.length} unique tokens in hypurrscan.io that are not in current cache`);
      
      // Fusionner les auctions des deux sources
      const mergedAuctions = this.mergeAuctions(currentAuctions, pastAuctions);
      console.log(`Total unique auctions after merging: ${mergedAuctions.length}`);
      
      // Sauvegarder le cache mis à jour
      this.auctionsCache = mergedAuctions.sort((a, b) => b.time - a.time);
      this.lastUpdateTime = Date.now();
      await this.saveCacheToDisk();
      console.log(`Cache saved to disk with ${mergedAuctions.length} auctions`);
      
    } catch (error) {
      console.error('Error updating cache:', error);
      throw error;
    } finally {
      this.isUpdating = false;
    }
  }

  // Commenté pour éviter les erreurs de base de données
  /*
  private async saveAuctionToDatabase(tokenId: string, auction: AuctionInfo): Promise<void> {
    try {
      // Code de sauvegarde en base de données désactivé
    } catch (error) {
      console.error(`Error saving auction ${tokenId} to database:`, error);
    }
  }
  */
}