import rateLimit from 'express-rate-limit';

export const marketRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limite à 30 requêtes par minute
  message: {
    error: 'Too many requests from this IP, please try again after a minute',
  },
  standardHeaders: true,
  legacyHeaders: false,
}); 