interface RateLimitConfig {
  maxWeightPerMinute: number;
  requestWeight: number;
}

export class RateLimiterService {
  private static instances = new Map<string, RateLimiterService>();
  private readonly config: RateLimitConfig;
  private requestWeights: Map<string, { weight: number; timestamp: number }[]>;

  private constructor(config: RateLimitConfig) {
    this.config = config;
    this.requestWeights = new Map();
  }

  public static getInstance(serviceName: string, config: RateLimitConfig): RateLimiterService {
    if (!RateLimiterService.instances.has(serviceName)) {
      RateLimiterService.instances.set(serviceName, new RateLimiterService(config));
    }
    return RateLimiterService.instances.get(serviceName)!;
  }

  public checkRateLimit(ip: string): boolean {
    this.cleanupOldEntries(ip);
    const totalWeight = this.getTotalWeight(ip);

    if (totalWeight + this.config.requestWeight > this.config.maxWeightPerMinute) {
      return false;
    }

    this.addRequest(ip);
    return true;
  }

  public getCurrentWeight(ip: string): number {
    this.cleanupOldEntries(ip);
    return this.getTotalWeight(ip);
  }

  private cleanupOldEntries(ip: string): void {
    const now = Date.now();
    const entries = this.requestWeights.get(ip) || [];
    const recentEntries = entries.filter(entry => now - entry.timestamp < 60000);
    this.requestWeights.set(ip, recentEntries);
  }

  private getTotalWeight(ip: string): number {
    const entries = this.requestWeights.get(ip) || [];
    return entries.reduce((total, entry) => total + entry.weight, 0);
  }

  private addRequest(ip: string): void {
    const entries = this.requestWeights.get(ip) || [];
    entries.push({ weight: this.config.requestWeight, timestamp: Date.now() });
    this.requestWeights.set(ip, entries);
  }
} 