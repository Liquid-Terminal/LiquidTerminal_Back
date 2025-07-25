import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth/auth.service';
import { PrivyPayload, UserRole } from '../types/auth.types';
import { TokenValidationError } from '../errors/auth.errors';
import { logDeduplicator } from '../utils/logDeduplicator';

declare global {
  namespace Express {
    interface Request {
      user?: PrivyPayload;
      currentUser?: {
        id: number;
        role: UserRole;
        privyUserId: string;
      };
    }
  }
}

const authService = AuthService.getInstance();

export const validatePrivyToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ 
      success: false,
      message: 'Bearer token required',
      code: 'MISSING_TOKEN'
    });
    return;
  }

  const token = authHeader.split(' ')[1];
  authService.verifyToken(token)
    .then(payload => {
      if (!payload.sub) {
        res.status(401).json({ 
          success: false,
          message: 'Invalid token payload',
          code: 'INVALID_PAYLOAD'
        });
        return;
      }
      req.user = payload;
      next();
    })
    .catch(error => {
      logDeduplicator.error('Token validation error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: req.path,
        method: req.method
      });
      
      if (error instanceof TokenValidationError) {
        res.status(error.statusCode).json({ 
          success: false,
          message: error.message,
          code: error.code
        });
        return;
      }
      
      res.status(401).json({ 
        success: false,
        message: 'Invalid or expired token',
        code: 'TOKEN_VALIDATION_ERROR'
      });
    });
}; 