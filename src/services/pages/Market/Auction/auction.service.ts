import { TokenDetailsApiService } from '../../../apiHyperliquid/Spot/tokenDetails.service';
import { SpotDeployStateApiService } from '../../../apiHyperliquid/Spot/spotDeployState.service';
import { SpotAssetContextService } from '../../../apiHyperliquid/Spot/spotAssetContext.service';
import { AuctionInfo, AuctionTimingInfo } from '../../../../types/auction.types';
import fs from 'fs/promises';
import path from 'path';

export class AuctionPageService {
  private readonly CACHE_FILE = path.join(process.cwd(), 'cache', 'auctions.json');
  private readonly UPDATE_INTERVAL = 31 * 60 * 60 * 1000; // 31 heures
  private readonly BATCH_SIZE = 5;
  private readonly DELAY_BETWEEN_BATCHES = 2000;

  private auctionsCache: AuctionInfo[] | null = null;
  private lastUpdateTime = 0;
  private isUpdating = false;
  private updateTimeout: NodeJS.Timeout | null = null;

  constructor(
    private tokenDetailsApi: TokenDetailsApiService,
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
    } catch (error) {
      console.error('Error saving cache to disk:', error);
    }
  }

  private async setupAutomaticUpdate(): Promise<void> {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    this.updateTimeout = setTimeout(async () => {
      await this.updateCache();
      this.setupAutomaticUpdate();
    }, this.UPDATE_INTERVAL);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async processBatch(tokenIds: string[]): Promise<AuctionInfo[]> {
    const results = [];
    for (const tokenId of tokenIds) {
      const details = await this.tokenDetailsApi.getTokenAuctionDetails(tokenId);
      if (details) {
        results.push(details);
      }
      await this.delay(500);
    }
    return results;
  }

  public async getAllAuctions(): Promise<AuctionInfo[]> {
    if (!this.auctionsCache && !this.isUpdating) {
      await this.updateCache();
    }
    return this.auctionsCache || [];
  }

  public async getAuctionTiming(): Promise<AuctionTimingInfo> {
    return this.spotDeployStateApi.getAuctionTiming();
  }

  public async forceUpdate(): Promise<void> {
    await this.updateCache();
    await this.setupAutomaticUpdate();
  }

  private async updateCache(): Promise<void> {
    if (this.isUpdating) return;
    
    try {
      this.isUpdating = true;
      const tokenIds = await this.spotAssetContextService.getTokenIds();
      const auctions: AuctionInfo[] = [];

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
      
    } catch (error) {
      console.error('Error updating cache:', error);
      throw error;
    } finally {
      this.isUpdating = false;
    }
  }
}