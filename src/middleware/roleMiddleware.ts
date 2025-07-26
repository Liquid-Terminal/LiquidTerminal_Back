import { Request, Response, NextFunction } from 'express';
import { prisma } from '../core/prisma.service';
import { logDeduplicator } from '../utils/logDeduplicator';
import { UserRole } from '@prisma/client';

export const requireRole = (allowedRoles: UserRole[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const privyUserId = req.user?.sub;
      console.log('Role middleware - privyUserId:', privyUserId);
      
      if (!privyUserId) {
        console.log('Role middleware - No privyUserId found');
        res.status(401).json({ 
          success: false, 
          error: 'User not authenticated', 
          code: 'UNAUTHENTICATED' 
        });
        return;
      }

      // Récupérer l'utilisateur avec son rôle
      console.log('Role middleware - Looking for user with privyUserId:', privyUserId);
      const user = await prisma.user.findUnique({
        where: { privyUserId },
        select: {
          id: true,
          role: true,
          privyUserId: true
        }
      });

      console.log('Role middleware - User found:', user);

      if (!user) {
        console.log('Role middleware - User not found in database');
        res.status(401).json({ 
          success: false, 
          error: 'User not found', 
          code: 'USER_NOT_FOUND' 
        });
        return;
      }

      console.log('Role middleware - User role:', user.role, 'Required roles:', allowedRoles);
      
      if (!allowedRoles.includes(user.role)) {
        console.log('Role middleware - Insufficient permissions');
        logDeduplicator.warn('Insufficient permissions', {
          privyUserId,
          userRole: user.role,
          requiredRoles: allowedRoles,
          path: req.path,
          method: req.method
        });
        
        res.status(403).json({ 
          success: false, 
          error: 'Insufficient permissions', 
          code: 'INSUFFICIENT_PERMISSIONS' 
        });
        return;
      }

      // Ajouter l'utilisateur à la requête pour éviter de refaire la requête
      req.currentUser = {
        id: user.id,
        role: user.role,
        privyUserId: user.privyUserId
      };
      next();
    } catch (error) {
      logDeduplicator.error('Role middleware error', { error });
      res.status(500).json({ 
        success: false, 
        error: 'Authorization error', 
        code: 'AUTHORIZATION_ERROR' 
      });
    }
  };
};

// Middlewares spécialisés pour chaque niveau
export const requireUser = requireRole([UserRole.USER, UserRole.MODERATOR, UserRole.ADMIN]);
export const requireModerator = requireRole([UserRole.MODERATOR, UserRole.ADMIN]);
export const requireAdmin = requireRole([UserRole.ADMIN]); 