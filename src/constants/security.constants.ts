export const SECURITY_CONSTANTS = {
  // Liste des origines autorisées pour les requêtes CORS
  ALLOWED_ORIGINS: [
    'https://liquidterminal.xyz',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002',
    'http://127.0.0.1:5173'
  ] as const,
  
  // Durée de validité du token JWT (24 heures)
  TOKEN_EXPIRY: 24 * 60 * 60,
  
  // Fenêtre de temps pour le rate limiting (1 minute)
  RATE_LIMIT_WINDOW: 60 * 1000
} as const; 