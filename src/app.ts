import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import authRoutes from './routes/auth.routes';
import marketSpotRoutes from './routes/Market/Spot/marketSpot.routes';
import marketPerpRoutes from './routes/Market/Perp/marketPerp.routes';
import walletRoutes from './routes/Wallet/wallet.routes';
import projectRoutes from './routes/project.routes';
import tokenInfoRoutes from './routes/Hyperliquid/Spot/tokenInfo.routes';
import tokenDetailsRoutes from './routes/Hyperliquid/Spot/tokenDetails.routes';
import spotDeployStateRoutes from './routes/Hyperliquid/Spot/spotDeployState.routes';
import spotBalanceRoutes from './routes/Hyperliquid/Spot/spotBalance.routes';
import spotAssetContextRoutes from './routes/Hyperliquid/Spot/spotAssetContext.routes';
import spotMetaRoutes from './routes/Hyperliquid/Spot/spotMeta.routes';
import perpAssetContextRoutes from './routes/Hyperliquid/Perp/perpAssetContext.routes';
import delegationsRoutes from './routes/Hyperliquid/Staking/delegations.routes';
import delegatorSummaryRoutes from './routes/Hyperliquid/Staking/delegatorSummary.routes';
import delegatorHistoryRoutes from './routes/Hyperliquid/Staking/delegatorHistory.routes';
import delegatorRewardsRoutes from './routes/Hyperliquid/Staking/delegatorRewards.routes';
import validatorSummariesRoutes from './routes/Hyperliquid/Staking/validatorSummaries.routes';
import dashboardGlobalStatsRoutes from './routes/globalStats.routes';

import globalStatsRoutes from './routes/Hyperliquid/globalStats.routes';
import bridgedUsdcRoutes from './routes/Hyperliquid/bridgedUsdc.routes';
import { setupWebSocket } from './websocket.server';
import auctionRoutes from './routes/Hyperliquid/Auction/auction.routes';

const app = express();
const server = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Routes Pages
app.use('/auth', authRoutes);
app.use('/pages/market/spot', marketSpotRoutes);
app.use('/pages/market/perp', marketPerpRoutes);
app.use('/pages/market/auction', auctionRoutes);
app.use('/pages/wallet', walletRoutes);
app.use('/pages/projects', projectRoutes);
app.use('/pages/dashboard/globalstats', dashboardGlobalStatsRoutes);

// Routes Hyperliquid
app.use('/hyperliquid/spot/token-info', tokenInfoRoutes);
app.use('/hyperliquid/spot/token-details', tokenDetailsRoutes);
app.use('/hyperliquid/spot/deploy-state', spotDeployStateRoutes);
app.use('/hyperliquid/spot/balance', spotBalanceRoutes);
app.use('/hyperliquid/spot/asset-context', spotAssetContextRoutes);
app.use('/hyperliquid/spot/meta', spotMetaRoutes);
app.use('/hyperliquid/perp/asset-context', perpAssetContextRoutes);
app.use('/hyperliquid/staking/delegations', delegationsRoutes);
app.use('/hyperliquid/staking/summary', delegatorSummaryRoutes);
app.use('/hyperliquid/staking/history', delegatorHistoryRoutes);
app.use('/hyperliquid/staking/rewards', delegatorRewardsRoutes);
app.use('/hyperliquid/staking/validators', validatorSummariesRoutes);
app.use('/hyperliquid/bridged-usdc', bridgedUsdcRoutes);
app.use('/hyperliquid/global-stats', globalStatsRoutes);

// WebSocket setup
setupWebSocket(server);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
