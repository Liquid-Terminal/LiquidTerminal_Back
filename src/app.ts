import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http'; // Importer le module HTTP
import explorerRoutes from './routes/market.routes';
import { setupWebSocket } from './websocket.server'; // Importer la configuration WebSocket

const app = express();

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', explorerRoutes);

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
