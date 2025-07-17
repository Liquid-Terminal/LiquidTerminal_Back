import { HyperliquidSpotClient } from '../clients/hyperliquid/spot/spot.assetcontext.client';
import { HyperliquidPerpClient } from '../clients/hyperliquid/perp/perp.assetcontext.client';
import { HyperliquidSpotDeployClient } from '../clients/hyperliquid/spot/spot.deploy.client';
import { HyperliquidTokenInfoClient } from '../clients/hyperliquid/spot/spot.tokeninfo.client';
import { ValidatorClient } from '../clients/hyperliquid/staking/validator';
import { HyperliquidVaultClient } from '../clients/hyperliquid/vault/hlpvault.client';
import { HyperliquidVaultsClient } from '../clients/hyperliquid/vault/vaults.client';
import { HypurrscanClient } from '../clients/hypurrscan/auction.client';
import { HypurrscanValidationClient } from '../clients/hypurrscan/validation.client';
import { HypurrscanUnstakingClient } from '../clients/hypurrscan/unstaking.client';
import { SpotUSDCClient } from '../clients/hypurrscan/spotUSDC.client';
import { HyperliquidSpotStatsClient } from '../clients/hyperliquid/spot/spot.stats.client';
import { HypurrscanFeesClient } from '../clients/hypurrscan/fees.client';
import { HyperliquidGlobalStatsClient } from '../clients/hyperliquid/globalstats.client';
import { HyperliquidLeaderboardClient } from '../clients/hyperliquid/leaderboard/leaderboard.client';
import { logDeduplicator } from '../utils/logDeduplicator';

export class ClientInitializerService {
  private static instance: ClientInitializerService;
  private clients: Map<string, any> = new Map();

  private constructor() {}

  public static getInstance(): ClientInitializerService {
    if (!ClientInitializerService.instance) {
      ClientInitializerService.instance = new ClientInitializerService();
    }
    return ClientInitializerService.instance;
  }

  public async initializeAll(): Promise<void> {
    try {
      await Promise.all([
        this.initializeMarketData(),
        this.initializeSpotStats(),
        this.initializePerpStats(),
        this.initializeGlobalStatsLiquid()
      ]);
      logDeduplicator.info('All clients initialized successfully');
    } catch (error) {
      logDeduplicator.error('Error initializing clients:', { error });
      throw error;
    }
  }

  private async initializeMarketData(): Promise<void> {
    // Implementation of initializeMarketData
  }

  private async initializeSpotStats(): Promise<void> {
    // Implementation of initializeSpotStats
  }

  private async initializePerpStats(): Promise<void> {
    // Implementation of initializePerpStats
  }

  private async initializeGlobalStatsLiquid(): Promise<void> {
    // Implementation of initializeGlobalStatsLiquid
  }

  public initialize(): void {
    try {
      // Initialiser le client Spot
      const spotClient = HyperliquidSpotClient.getInstance();
      this.clients.set('spot', spotClient);

      // Initialiser le client Perp
      const perpClient = HyperliquidPerpClient.getInstance();
      this.clients.set('perp', perpClient);

      // Initialiser le client Spot Deploy
      const spotDeployClient = HyperliquidSpotDeployClient.getInstance();
      this.clients.set('spotDeploy', spotDeployClient);

      // Initialiser le client Token Info
      const tokenInfoClient = HyperliquidTokenInfoClient.getInstance();
      this.clients.set('tokenInfo', tokenInfoClient);

      // Initialiser le client Validator
      const validatorClient = ValidatorClient.getInstance();
      this.clients.set('validator', validatorClient);

      // Initialiser le client Vault
      const vaultClient = HyperliquidVaultClient.getInstance();
      this.clients.set('vault', vaultClient);

      // Initialiser le client Vaults (liste des vaults)
      const vaultsClient = HyperliquidVaultsClient.getInstance();
      this.clients.set('vaults', vaultsClient);

      // Initialiser le client Spot Stats
      const spotStatsClient = HyperliquidSpotStatsClient.getInstance();
      this.clients.set('spotStats', spotStatsClient);

      // Initialiser les clients Hypurrscan
      const hypurrscanClient = HypurrscanClient.getInstance();
      this.clients.set('hypurrscanAuction', hypurrscanClient);

      const hypurrscanValidationClient = HypurrscanValidationClient.getInstance();
      this.clients.set('hypurrscanValidation', hypurrscanValidationClient);

      const hypurrscanUnstakingClient = HypurrscanUnstakingClient.getInstance();
      this.clients.set('hypurrscanUnstaking', hypurrscanUnstakingClient);

      const spotUSDCClient = SpotUSDCClient.getInstance();
      this.clients.set('spotUSDC', spotUSDCClient);

      // Initialiser le client Fees
      const feesClient = HypurrscanFeesClient.getInstance();
      this.clients.set('fees', feesClient);

      // Initialiser le client Global Stats
      const globalStatsClient = HyperliquidGlobalStatsClient.getInstance();
      this.clients.set('globalStats', globalStatsClient);

      // Initialiser le client Leaderboard
      const leaderboardClient = HyperliquidLeaderboardClient.getInstance();
      this.clients.set('leaderboard', leaderboardClient);

      // Démarrer le polling pour tous les clients
      this.startAllPolling();

      logDeduplicator.info('All clients initialized successfully');
    } catch (error) {
      logDeduplicator.error('Error initializing clients:', { error });
      throw error;
    }
  }

  private startAllPolling(): void {
    for (const [name, client] of this.clients.entries()) {
      if ('startPolling' in client) {
        try {
          client.startPolling();
          logDeduplicator.info(`Started polling for ${name} client`);
        } catch (error) {
          logDeduplicator.error(`Error starting polling for ${name} client:`, { error });
        }
      }
    }
  }

  public stopAllPolling(): void {
    for (const [name, client] of this.clients.entries()) {
      if ('stopPolling' in client) {
        try {
          client.stopPolling();
          logDeduplicator.info(`Stopped polling for ${name} client`);
        } catch (error) {
          logDeduplicator.error(`Error stopping polling for ${name} client:`, { error });
        }
      }
    }
  }
} 