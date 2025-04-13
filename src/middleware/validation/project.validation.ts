import { Request, Response, NextFunction } from 'express';
import { validateRequest } from './validation.middleware';
import {
  createProjectSchema,
  updateProjectSchema,
  projectQuerySchema,
  createCategorySchema,
  updateCategorySchema,
  categoryQuerySchema
} from '../../schemas/project.schema';

// Project validation middleware
export const validateCreateProject = (req: Request, res: Response, next: NextFunction) => {
  return validateRequest(createProjectSchema)(req, res, next);
};

export const validateUpdateProject = (req: Request, res: Response, next: NextFunction) => {
  return validateRequest(updateProjectSchema)(req, res, next);
};

export const validateProjectQuery = (req: Request, res: Response, next: NextFunction) => {
  return validateRequest(projectQuerySchema)(req, res, next);
};

// Category validation middleware
export const validateCreateCategory = (req: Request, res: Response, next: NextFunction) => {
  return validateRequest(createCategorySchema)(req, res, next);
};

export const validateUpdateCategory = (req: Request, res: Response, next: NextFunction) => {
  return validateRequest(updateCategorySchema)(req, res, next);
};

export const validateCategoryQuery = (req: Request, res: Response, next: NextFunction) => {
  return validateRequest(categoryQuerySchema)(req, res, next);
}; 