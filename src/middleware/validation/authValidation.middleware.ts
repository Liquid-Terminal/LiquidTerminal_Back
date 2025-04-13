import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { loginSchema, userParamsSchema } from '../../schemas/auth.schema';

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
export const validateLogin = validateRequest(loginSchema);

// Middleware spécifique pour la validation des paramètres utilisateur
export const validateUserParams = validateRequest(userParamsSchema); 