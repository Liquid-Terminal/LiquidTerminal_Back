import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Middleware pour générer un Request ID unique pour chaque requête
 * Permet le traçage des requêtes dans les logs de bout en bout
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Générer un UUID v4 unique pour cette requête
  const requestId = randomUUID();
  
  // Attacher le requestId à la requête pour utilisation dans les logs
  (req as any).requestId = requestId;
  
  // Ajouter le Request-ID dans les headers de réponse
  res.setHeader('X-Request-Id', requestId);
  
  next();
};

