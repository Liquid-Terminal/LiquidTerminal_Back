import jwt from 'jsonwebtoken';
import { AuthenticatedWebSocket, AuthMessage } from '../../types/security.types';

export class AuthService {
  private static instance: AuthService;
  private readonly JWT_SECRET: string;

  private constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  public async validateToken(token: string): Promise<string | null> {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as { userId: string };
      return decoded.userId;
    } catch (error) {
      console.error('Token validation error:', error);
      return null;
    }
  }

  public async authenticateConnection(ws: AuthenticatedWebSocket, message: AuthMessage): Promise<boolean> {
    try {
      const userId = await this.validateToken(message.token);
      if (!userId) {
        return false;
      }

      ws.userId = userId;
      ws.token = message.token;
      return true;
    } catch (error) {
      console.error('Authentication error:', error);
      return false;
    }
  }

  public isAuthenticated(ws: AuthenticatedWebSocket): boolean {
    return !!ws.userId && !!ws.token;
  }
} 