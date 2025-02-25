import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import authRoutes from './routes/auth.routes';
import marketSpotRoutes from './routes/market/Spot/marketSpot.routes';
import marketPerpRoutes from './routes/market/Perp/marketPerp.routes';
import walletRoutes from './routes/wallet/wallet.routes';
import projectRoutes from './routes/project.routes';
import tokenInfoRoutes from './routes/hyperLiquid/spot/tokenInfo.routes';
import tokenDetailsRoutes from './routes/hyperLiquid/spot/tokenDetails.routes';
import spotDeployStateRoutes from './routes/hyperLiquid/spot/spotDeployState.routes';
import spotBalanceRoutes from './routes/hyperLiquid/spot/spotBalance.routes';
import spotAssetContextRoutes from './routes/hyperLiquid/spot/spotAssetContext.routes';
import spotMetaRoutes from './routes/hyperLiquid/spot/spotMeta.routes';
import spotUSDCRoutes from './routes/hyperLiquid/spot/spotUSDC.routes';
import perpAssetContextRoutes from './routes/hyperLiquid/perp/perpAssetContext.routes';
import delegationsRoutes from './routes/hyperLiquid/staking/delegations.routes';
import delegatorSummaryRoutes from './routes/hyperLiquid/staking/delegatorSummary.routes';
import delegatorHistoryRoutes from './routes/hyperLiquid/staking/delegatorHistory.routes';
import delegatorRewardsRoutes from './routes/hyperLiquid/staking/delegatorRewards.routes';
import validatorSummariesRoutes from './routes/hyperLiquid/staking/validatorSummaries.routes';
import dashboardGlobalStatsRoutes from './routes/globalStats.routes';
import globalSpotStatsRoutes from './routes/market/Spot/globalSpotStats.routes';

import globalStatsRoutes from './routes/hyperLiquid/globalStats.routes';
import bridgedUsdcRoutes from './routes/hyperLiquid/bridgedUsdc.routes';
import { setupWebSocket } from './websocket.server';
import auctionRoutes from './routes/hyperLiquid/auction/auction.routes';

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
app.use('/pages/market/spot/globalstats', globalSpotStatsRoutes);

// Routes Hyperliquid
app.use('/hyperliquid/spot/token-info', tokenInfoRoutes);
app.use('/hyperliquid/spot/token-details', tokenDetailsRoutes);
app.use('/hyperliquid/spot/deploy-state', spotDeployStateRoutes);
app.use('/hyperliquid/spot/balance', spotBalanceRoutes);
app.use('/hyperliquid/spot/asset-context', spotAssetContextRoutes);
app.use('/hyperliquid/spot/meta', spotMetaRoutes);
app.use('/hyperliquid/spot/usdc', spotUSDCRoutes);
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
