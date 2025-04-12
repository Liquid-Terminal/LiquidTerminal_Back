import { WebSocket } from 'ws';

export interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  token?: string;
  ip?: string;
  lastMessageTime?: number;
  messageCount?: number;
}

export interface AuthMessage {
  type: 'auth';
  token: string;
}

export interface WebSocketMessage {
  type: string;
  data?: any;
}

export const SECURITY_CONSTANTS = {
  MESSAGE_SIZE_LIMIT: 1024 * 1024, // 1MB
  MAX_MESSAGES_PER_MINUTE: 100,
  MAX_CONNECTIONS_PER_IP: 5,
  ALLOWED_ORIGINS: ['https://liquidterminal.xyz', 'http://localhost:3000'],
  TOKEN_EXPIRY: 24 * 60 * 60 * 1000, // 24 hours
  RATE_LIMIT_WINDOW: 60 * 1000, // 1 minute
} as const; 