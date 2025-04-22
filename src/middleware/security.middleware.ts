import { Request, Response, NextFunction } from 'express';

/**
 * Middleware pour ajouter des en-têtes de sécurité à toutes les réponses
 * @param req Requête Express
 * @param res Réponse Express
 * @param next Fonction next
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Protection contre le sniffing de type MIME
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Protection contre le clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Protection XSS pour les navigateurs plus anciens
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Politique de référent pour contrôler les informations envoyées dans l'en-tête Referer
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Forcer HTTPS avec HSTS (1 an de durée) - désactivé en développement
  if (process.env.NODE_ENV !== 'development') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // Permissions-Policy (anciennement Feature-Policy) pour contrôler les fonctionnalités du navigateur
  res.setHeader(
    'Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
  );
  
  // X-Permitted-Cross-Domain-Policies pour contrôler les politiques de domaine croisé
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  
  // Expect-CT pour signaler les certificats non conformes
  res.setHeader('Expect-CT', 'enforce, max-age=30');
  
  // Cross-Origin-Embedder-Policy pour l'isolation des origines - désactivé en développement
  if (process.env.NODE_ENV !== 'development') {
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  }
  
  // Cross-Origin-Opener-Policy pour l'isolation des origines - désactivé en développement
  if (process.env.NODE_ENV !== 'development') {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  }
  
  // X-Download-Options pour empêcher le téléchargement automatique des fichiers
  res.setHeader('X-Download-Options', 'noopen');
  
  // Content Security Policy (à adapter selon vos besoins)
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
  );
  
  // Désactiver la mise en cache pour les réponses sensibles
  if (req.path.startsWith('/auth') || req.path.includes('token')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  next();
}; 