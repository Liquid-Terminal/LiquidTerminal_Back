import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import authRoutes from './routes/auth.routes';
import marketSpotRoutes from './routes/Spot/marketSpot.routes';
import marketSpotTrendingRoutes from './routes/Spot/marketSpotTrending.routes';
import marketPerpRoutes from './routes/Perp/marketPerp.routes';
import marketPerpTrendingRoutes from './routes/Perp/marketPerpTrending.routes';
import walletRoutes from './routes/wallet/wallet.routes';
import projectRoutes from './routes/project/project.routes';
import categoryRoutes from './routes/project/category.routes';
import validatorRoutes from './routes/staking/validator.routes';

import dashboardGlobalStatsRoutes from './routes/globalStats.routes';
import globalSpotStatsRoutes from './routes/Spot/globalSpotStats.routes';
import globalPerpStatsRoutes from './routes/Perp/globalPerpStats.routes';

import auctionRoutes from './routes/Spot/auction.routes';

const app = express();
const server = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Routes Pages
app.use('/auth', authRoutes);
app.use('/pages/market/spot', marketSpotRoutes);
app.use('/pages/market/spot/trending', marketSpotTrendingRoutes);
app.use('/pages/market/perp', marketPerpRoutes);
app.use('/pages/market/perp/trending', marketPerpTrendingRoutes);
app.use('/pages/market/auction', auctionRoutes);
app.use('/pages/wallet', walletRoutes);
app.use('/pages/projects', projectRoutes);
app.use('/pages/categories', categoryRoutes);
app.use('/pages/staking/validators', validatorRoutes);
app.use('/dashboard/globalstats', dashboardGlobalStatsRoutes);
app.use('/pages/market/spot/globalstats', globalSpotStatsRoutes);
app.use('/pages/market/perp/globalstats', globalPerpStatsRoutes);

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;