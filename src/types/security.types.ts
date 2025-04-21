import { WebSocket } from 'ws';

// Types pour les WebSockets authentifiés
export interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  token?: string;
  ip?: string;
  lastMessageTime?: number;
  messageCount?: number;
}

// Types pour les messages WebSocket
export interface AuthMessage {
  type: 'auth';
  token: string;
}

export interface WebSocketMessage {
  type: string;
  data?: any;
}

// Constantes de sécurité
export const SECURITY_CONSTANTS = {
  // Limites de taille et de fréquence des messages
  MESSAGE_SIZE_LIMIT: 1024 * 1024, // 1MB
  MAX_MESSAGES_PER_MINUTE: 100,
  MAX_CONNECTIONS_PER_IP: 5,
  
  // Configuration CORS
  ALLOWED_ORIGINS: ['https://liquidterminal.xyz', 'http://localhost:3000'],
  
  // Configuration des tokens
  TOKEN_EXPIRY: 24 * 60 * 60 * 1000, // 24 hours
  
  // Configuration du rate limiting
  RATE_LIMIT_WINDOW: 60 * 1000, // 1 minute
} as const; 