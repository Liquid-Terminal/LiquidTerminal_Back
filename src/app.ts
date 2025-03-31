import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import authRoutes from './routes/auth.routes';
import marketSpotRoutes from './routes/market/Spot/marketSpot.routes';
import marketPerpRoutes from './routes/market/Perp/marketPerp.routes';
import walletRoutes from './routes/wallet/wallet.routes';
import projectRoutes from './routes/project/project.routes';
import categoryRoutes from './routes/project/category.routes';
import walletDetailsRoutes from './routes/explorer/walletDetails.routes';
import blockDetailsRoutes from './routes/explorer/blockDetails.routes';
import txDetailsRoutes from './routes/explorer/txDetails.routes';

import dashboardGlobalStatsRoutes from './routes/globalStats.routes';
import globalSpotStatsRoutes from './routes/market/Spot/globalSpotStats.routes';
import globalPerpStatsRoutes from './routes/market/Perp/globalPerpStats.routes';

import { setupWebSocket } from './websocket.server';
import auctionRoutes from './routes/market/auction.routes';

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
app.use('/pages/categories', categoryRoutes);
app.use('/dashboard/globalstats', dashboardGlobalStatsRoutes);
app.use('/pages/market/spot/globalstats', globalSpotStatsRoutes);
app.use('/pages/market/perp/globalstats', globalPerpStatsRoutes);

// Routes Explorer
app.use('/explorer', walletDetailsRoutes);
app.use('/explorer/block', blockDetailsRoutes);
app.use('/explorer/tx', txDetailsRoutes);

// Routes Hyperliquid

// WebSocket setup
setupWebSocket(server);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;