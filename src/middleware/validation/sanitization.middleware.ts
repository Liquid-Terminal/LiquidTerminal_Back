import { Request, Response, NextFunction } from 'express';
import sanitizeHtml from 'sanitize-html';

/**
 * Middleware de sanitization pour nettoyer les entrées utilisateur
 * Ce middleware doit être appliqué avant la validation
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Sanitization personnalisée pour les paramètres de requête
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeString(req.query[key] as string);
      }
    });
  }

  // Sanitization personnalisée pour les paramètres de route
  if (req.params) {
    Object.keys(req.params).forEach(key => {
      if (typeof req.params[key] === 'string') {
        req.params[key] = sanitizeString(req.params[key] as string);
      }
    });
  }

  // Sanitization personnalisée pour le corps de la requête
  if (req.body) {
    sanitizeObject(req.body);
  }

  next();
};

/**
 * Fonction utilitaire pour sanitizer une chaîne de caractères
 * @param str Chaîne à sanitizer
 * @returns Chaîne sanitizée
 */
function sanitizeString(str: string): string {
  // Utiliser sanitize-html pour nettoyer le HTML
  str = sanitizeHtml(str, {
    allowedTags: [], // Ne pas autoriser de tags HTML
    allowedAttributes: {}, // Ne pas autoriser d'attributs
    textFilter: (text: string) => {
      // Supprimer les caractères de contrôle
      return text.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
    }
  });
  
  // Supprimer les espaces multiples
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Fonction utilitaire pour sanitizer un objet récursivement
 * @param obj Objet à sanitizer
 */
function sanitizeObject(obj: any): void {
  if (!obj || typeof obj !== 'object') {
    return;
  }

  Object.keys(obj).forEach(key => {
    if (typeof obj[key] === 'string') {
      obj[key] = sanitizeString(obj[key]);
    } else if (typeof obj[key] === 'object') {
      sanitizeObject(obj[key]);
    }
  });
} 