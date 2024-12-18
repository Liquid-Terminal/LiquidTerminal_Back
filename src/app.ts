import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http'; // Importer le module HTTP
import marketRoutes from './routes/market.routes';
import strictListRoutes from './routes/strictList.routes'; // Importer la nouvelle route Strict List
import authRoutes from './routes/auth.routes';  // Ajouter l'import
import { setupWebSocket } from './websocket.server';
import walletRoutes from './routes/wallet.routes';  // Ajouter l'import
import projectRoutes from './routes/project.routes';  // Ajouter l'import
import tokenInfoRoutes from './routes/tokenInfo.routes';  // Ajouter l'import
import auctionRoutes from './routes/auction.routes';

const app = express();

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/markets', marketRoutes);
app.use('/api', strictListRoutes); // Ajouter la route Strict List
app.use('/api/auth', authRoutes);  // Ajouter la route d'authentification
app.use('/api/wallets', walletRoutes);  // Ajouter la route
app.use('/api/projects', projectRoutes);  // Ajouter la route
app.use('/api/token-info', tokenInfoRoutes);  // Ajouter la route
app.use('/api/auctions', auctionRoutes);

// Créer le serveur HTTP
const server = http.createServer(app);

// Configurer WebSocket sur le serveur HTTP
setupWebSocket(server);

// Démarrer le serveur
const PORT = process.env.PORT ?? 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
