import { TokenIDListService } from './tokenContract.service';
import { AuctionInfo, GasAuctionResponse, AuctionTimingInfo } from '../types/auction.types';
import fs from 'fs/promises';
import path from 'path';

export class AuctionService {
  private readonly HYPERLIQUID_UI_API = 'https://api-ui.hyperliquid.xyz/info';
  private readonly BATCH_SIZE = 5;
  private readonly DELAY_BETWEEN_BATCHES = 2000;
  private readonly RETRY_DELAY = 3000;
  private readonly MAX_RETRIES = 3;
  private readonly CACHE_FILE = path.join(process.cwd(), 'cache', 'auctions.json');
  private readonly UPDATE_INTERVAL = 31 * 60 * 60 * 1000; // 31 heures en ms

  private auctionsCache: AuctionInfo[] | null = null;
  private lastUpdateTime = 0;
  private isUpdating = false;
  private updateTimeout: NodeJS.Timeout | null = null;

  constructor(private tokenIDListService: TokenIDListService) {
    fs.mkdir(path.dirname(this.CACHE_FILE), { recursive: true }).catch(console.error);
    this.loadCacheFromDisk().catch(console.error);
    this.setupAutomaticUpdate();
  }

  private async setupAutomaticUpdate(): Promise<void> {
    // Nettoyer l'ancien timeout s'il existe
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }

    // Programmer la prochaine mise à jour dans 31 heures
    this.updateTimeout = setTimeout(async () => {
      await this.updateCache();
      // Programmer la prochaine mise à jour
      this.setupAutomaticUpdate();
    }, this.UPDATE_INTERVAL);

    console.log(`Next cache update scheduled in ${this.UPDATE_INTERVAL / 1000 / 60 / 60} hours`);
  }

  private async loadCacheFromDisk(): Promise<void> {
    try {
      const data = await fs.readFile(this.CACHE_FILE, 'utf-8');
      const cached = JSON.parse(data);
      this.auctionsCache = cached.auctions;
      this.lastUpdateTime = cached.lastUpdateTime;
      console.log(`Loaded ${this.auctionsCache?.length || 0} auctions from cache file`);
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
      console.log('Cache saved to disk');
    } catch (error) {
      console.error('Error saving cache to disk:', error);
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async fetchTokenDetails(tokenId: string, retryCount = 0): Promise<AuctionInfo | null> {
    try {
      const response = await fetch(this.HYPERLIQUID_UI_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: "tokenDetails",
          tokenId
        })
      });

      if (response.status === 429 && retryCount < this.MAX_RETRIES) {
        console.log(`Rate limited for token ${tokenId}, retry ${retryCount + 1}/${this.MAX_RETRIES} after ${this.RETRY_DELAY}ms`);
        await this.delay(this.RETRY_DELAY);
        return this.fetchTokenDetails(tokenId, retryCount + 1);
      }

      if (!response.ok) {
        console.error(`Failed to fetch token ${tokenId}, status: ${response.status}`);
        return null;
      }

      const data = await response.json();
      
      return {
        time: new Date(data.deployTime).getTime(),
        deployer: data.deployer,
        name: data.name,
        deployGas: data.deployGas
      };
    } catch (error) {
      console.error(`Error processing tokenId ${tokenId}:`, error);
      return null;
    }
  }

  private async processBatch(tokenIds: string[]): Promise<AuctionInfo[]> {
    const results = [];
    
    for (const tokenId of tokenIds) {
      const result = await this.fetchTokenDetails(tokenId);
      if (result) {
        results.push(result);
      }
      await this.delay(500);
    }

    return results;
  }

  private async updateCache(): Promise<void> {
    if (this.isUpdating) return;
    
    try {
      this.isUpdating = true;
      console.log('Starting cache update after auction completion');
      
      const tokenIds = await this.tokenIDListService.getTokenIds();
      const auctions: AuctionInfo[] = [];

      console.log(`Updating cache for ${tokenIds.length} tokens`);

      for (let i = 0; i < tokenIds.length; i += this.BATCH_SIZE) {
        const batch = tokenIds.slice(i, i + this.BATCH_SIZE);
        const batchResults = await this.processBatch(batch);
        auctions.push(...batchResults);
        
        if (i + this.BATCH_SIZE < tokenIds.length) {
          await this.delay(this.DELAY_BETWEEN_BATCHES);
        }
      }

      this.auctionsCache = auctions.sort((a, b) => b.time - a.time);
      this.lastUpdateTime = Date.now();

      await this.saveCacheToDisk();
      
      console.log(`Cache updated with ${auctions.length} auctions`);
    } catch (error) {
      console.error('Error updating cache:', error);
      throw error;
    } finally {
      this.isUpdating = false;
    }
  }

  public async getAllAuctions(): Promise<AuctionInfo[]> {
    if (!this.auctionsCache && !this.isUpdating) {
      await this.updateCache();
    }
    return this.auctionsCache || [];
  }

  public async forceUpdate(): Promise<void> {
    await this.updateCache();
    // Réinitialiser le planning de mise à jour automatique
    await this.setupAutomaticUpdate();
  }

  public async getAuctionTiming(): Promise<AuctionTimingInfo> {
    try {
      const response = await fetch(this.HYPERLIQUID_UI_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: "gasAuctionState"
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch auction timing: ${response.status}`);
      }

      const data = await response.json() as GasAuctionResponse;
      const { gasAuction } = data;

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
} 