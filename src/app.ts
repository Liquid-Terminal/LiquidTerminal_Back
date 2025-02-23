import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import authRoutes from './routes/auth.routes';
import marketRoutes from './routes/Pages/Market/Spot/marketSpot.routes';
import walletRoutes from './routes/Pages/Wallet/wallet.routes';
import projectRoutes from './routes/project.routes';
import tokenInfoRoutes from './routes/Hyperliquid/Spot/tokenInfo.routes';
import tokenDetailsRoutes from './routes/Hyperliquid/Spot/tokenDetails.routes';
import spotDeployStateRoutes from './routes/Hyperliquid/Spot/spotDeployState.routes';
import spotBalanceRoutes from './routes/Hyperliquid/Spot/spotBalance.routes';
import spotAssetContextRoutes from './routes/Hyperliquid/Spot/spotAssetContext.routes';
import spotMetaRoutes from './routes/Hyperliquid/Spot/spotMeta.routes';
import delegationsRoutes from './routes/Hyperliquid/Staking/delegations.routes';
import delegatorSummaryRoutes from './routes/Hyperliquid/Staking/delegatorSummary.routes';
import delegatorHistoryRoutes from './routes/Hyperliquid/Staking/delegatorHistory.routes';
import delegatorRewardsRoutes from './routes/Hyperliquid/Staking/delegatorRewards.routes';
import validatorSummariesRoutes from './routes/Hyperliquid/Staking/validatorSummaries.routes';
import globalStatsRoutes from './routes/Hyperliquid/globalStats.routes';
import bridgedUsdcRoutes from './routes/Hyperliquid/bridgedUsdc.routes';
import { setupWebSocket } from './websocket.server';
import auctionRoutes from './routes/Pages/Market/Auction/auction.routes';

const app = express();
const server = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/markets', marketRoutes);
app.use('/api/wallets', walletRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/token-info', tokenInfoRoutes);
app.use('/api/token-details', tokenDetailsRoutes);
app.use('/api/spot-deploy-state', spotDeployStateRoutes);
app.use('/api/spot-balance', spotBalanceRoutes);
app.use('/api/spot-asset-context', spotAssetContextRoutes);
app.use('/api/spot-meta', spotMetaRoutes);
app.use('/api/staking/delegations', delegationsRoutes);
app.use('/api/staking/summary', delegatorSummaryRoutes);
app.use('/api/staking/history', delegatorHistoryRoutes);
app.use('/api/staking/rewards', delegatorRewardsRoutes);
app.use('/api/staking/validators', validatorSummariesRoutes);
app.use('/api/bridged-usdc', bridgedUsdcRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api/global-stats', globalStatsRoutes);

// WebSocket setup
setupWebSocket(server);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
