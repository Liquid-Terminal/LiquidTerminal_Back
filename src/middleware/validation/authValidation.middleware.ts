import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { loginSchema, userParamsSchema } from '../../schemas/auth.schema';
import { logDeduplicator } from '../../utils/logDeduplicator';

// Middleware de validation générique
export const validateRequest = (schema: AnyZodObject) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: 'Internal server error during validation',
      });
    }
  };
};

// Middleware spécifique pour la validation de la connexion
export const validateLogin = (req: Request, res: Response, next: NextFunction): void => {
  try {
    logDeduplicator.info('Validating login request', { 
      body: req.body,
      path: req.path,
      method: req.method 
    });
    
    const validatedData = loginSchema.parse(req.body);
    
    logDeduplicator.info('Login validation successful', { 
      privyUserId: validatedData.privyUserId,
      name: validatedData.name 
    });
    
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      logDeduplicator.warn('Login validation failed', { 
        errors: error.errors,
        body: req.body,
        path: req.path 
      });
      
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
      return;
    }
    
    logDeduplicator.error('Unexpected validation error', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      body: req.body,
      path: req.path 
    });
    
    res.status(500).json({
      success: false,
      message: 'Internal server error during validation',
    });
  }
};

// Middleware spécifique pour la validation des paramètres utilisateur
export const validateUserParams = (req: Request, res: Response, next: NextFunction): void => {
  try {
    logDeduplicator.info('Validating user params', { 
      params: req.params,
      path: req.path 
    });
    
    const validatedData = userParamsSchema.parse(req.params);
    
    logDeduplicator.info('User params validation successful', { 
      privyUserId: validatedData.privyUserId 
    });
    
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      logDeduplicator.warn('User params validation failed', { 
        errors: error.errors,
        params: req.params,
        path: req.path 
      });
      
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
      return;
    }
    
    logDeduplicator.error('Unexpected validation error', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      params: req.params,
      path: req.path 
    });
    
    res.status(500).json({
      success: false,
      message: 'Internal server error during validation',
    });
  }
}; 