import { Request, Response, NextFunction } from 'express';
import { 
  loginSchema, 
  userParamsSchema,
  adminUserUpdateSchema
} from '../../schemas/auth.schema';
import { logDeduplicator } from '../../utils/logDeduplicator';

// Validation pour la connexion
export const validateLogin = (req: Request, res: Response, next: NextFunction): void => {
  try {
    loginSchema.parse(req.body);
    next();
  } catch (error) {
    logDeduplicator.warn('Login validation failed', { 
      error: error instanceof Error ? error.message : String(error),
      body: req.body 
    });
    
    res.status(400).json({
      success: false,
      message: 'Invalid login data',
      code: 'INVALID_LOGIN_DATA'
    });
  }
};

// Validation pour les paramètres utilisateur
export const validateUserParams = (req: Request, res: Response, next: NextFunction): void => {
  try {
    userParamsSchema.parse(req.params);
    next();
  } catch (error) {
    logDeduplicator.warn('User params validation failed', { 
      error: error instanceof Error ? error.message : String(error),
      params: req.params 
    });
    
    res.status(400).json({
      success: false,
      message: 'Invalid user parameters',
      code: 'INVALID_USER_PARAMS'
    });
  }
};

// Validation pour la mise à jour d'utilisateur admin (le plus important pour verified)
export const validateAdminUserUpdate = (req: Request, res: Response, next: NextFunction): void => {
  try {
    adminUserUpdateSchema.parse(req.body);
    next();
  } catch (error) {
    logDeduplicator.warn('Admin user update validation failed', { 
      error: error instanceof Error ? error.message : String(error),
      body: req.body 
    });
    
    res.status(400).json({
      success: false,
      message: 'Invalid update data',
      code: 'INVALID_UPDATE_DATA'
    });
  }
}; 