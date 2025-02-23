import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { PrivyPayload } from '../types/auth.types';

declare global {
  namespace Express {
    interface Request {
      user?: PrivyPayload;
    }
  }
}

const authService = new AuthService();

export const validatePrivyToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Bearer token required' });
    return;
  }

  const token = authHeader.split(' ')[1];
  authService.verifyToken(token)
    .then(payload => {
      if (!payload.sub) {
        res.status(401).json({ message: 'Invalid token payload' });
        return;
      }
      req.user = payload;
      next();
    })
    .catch(error => {
      console.error('Token validation error:', error);
      res.status(401).json({ message: 'Invalid or expired token' });
    });
}; 