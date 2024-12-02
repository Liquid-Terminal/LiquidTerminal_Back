// src/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import explorerRoutes from './routes/market.routes';

const app = express();

// Middlewares
app.use(helmet());  // Sécurité
app.use(cors());    // Pour permettre les appels depuis ton front
app.use(express.json()); // Pour parser le JSON

// Routes
app.use('/api', explorerRoutes);

// Démarrage du serveur
const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;