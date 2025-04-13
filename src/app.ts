import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { sanitizeInput } from './middleware/validation';
import { SECURITY_CONSTANTS } from './constants/security.constants';
import { securityHeaders } from './middleware/security.middleware';
import authRoutes from './routes/auth.routes';
import marketSpotRoutes from './routes/spot/marketSpot.routes';
import marketSpotTrendingRoutes from './routes/spot/marketSpotTrending.routes';
import marketPerpRoutes from './routes/perp/marketPerp.routes';
import marketPerpTrendingRoutes from './routes/perp/marketPerpTrending.routes';
import walletRoutes from './routes/wallet/wallet.routes';
import projectRoutes from './routes/project/project.routes';
import categoryRoutes from './routes/project/category.routes';
import validatorRoutes from './routes/staking/validator.routes';

import dashboardGlobalStatsRoutes from './routes/globalStats.routes';
import globalSpotStatsRoutes from './routes/spot/globalSpotStats.routes';
import globalPerpStatsRoutes from './routes/perp/globalPerpStats.routes';

import auctionRoutes from './routes/spot/auction.routes';

const app = express();
const server = createServer(app);

// Configuration CORS basée sur les constantes de sécurité
app.use(cors({
  origin: (origin, callback) => {
    // En développement, autoriser toutes les origines
    if (process.env.NODE_ENV === 'development') {
      callback(null, true);
    } 
    // En production, vérifier contre les origines autorisées
    else if (!origin || SECURITY_CONSTANTS.ALLOWED_ORIGINS.includes(origin as typeof SECURITY_CONSTANTS.ALLOWED_ORIGINS[number])) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Ajouter les en-têtes de sécurité
app.use(securityHeaders);

app.use(express.json());

// Appliquer la sanitization globalement
app.use(sanitizeInput);

// Routes Pages
app.use('/auth', authRoutes);
app.use('/market/spot', marketSpotRoutes);
app.use('/market/spot/trending', marketSpotTrendingRoutes);
app.use('/market/perp', marketPerpRoutes);
app.use('/market/perp/trending', marketPerpTrendingRoutes);
app.use('/market/auction', auctionRoutes);
app.use('/wallet', walletRoutes);
app.use('/projects', projectRoutes);
app.use('/categories', categoryRoutes);
app.use('/staking/validators', validatorRoutes);
app.use('/dashboard/globalstats', dashboardGlobalStatsRoutes);
app.use('/pages/market/spot/globalstats', globalSpotStatsRoutes);
app.use('/pages/market/perp/globalstats', globalPerpStatsRoutes);

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;