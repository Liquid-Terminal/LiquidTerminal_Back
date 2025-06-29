import { Request, Response, NextFunction } from 'express';
import { validateRequest } from './validation.middleware';
import {
  createEducationalCategorySchema,
  updateEducationalCategorySchema,
  educationalCategoryQuerySchema,
  createEducationalResourceSchema,
  updateEducationalResourceSchema,
  educationalResourceQuerySchema,
  assignResourceToCategorySchema
} from '../../schemas/educational.schema';

// Educational Category validation middleware
export const validateCreateEducationalCategory = (req: Request, res: Response, next: NextFunction) => {
  return validateRequest(createEducationalCategorySchema)(req, res, next);
};

export const validateUpdateEducationalCategory = (req: Request, res: Response, next: NextFunction) => {
  return validateRequest(updateEducationalCategorySchema)(req, res, next);
};

export const validateEducationalCategoryQuery = (req: Request, res: Response, next: NextFunction) => {
  return validateRequest(educationalCategoryQuerySchema)(req, res, next);
};

// Educational Resource validation middleware
export const validateCreateEducationalResource = (req: Request, res: Response, next: NextFunction) => {
  return validateRequest(createEducationalResourceSchema)(req, res, next);
};

export const validateUpdateEducationalResource = (req: Request, res: Response, next: NextFunction) => {
  return validateRequest(updateEducationalResourceSchema)(req, res, next);
};

export const validateEducationalResourceQuery = (req: Request, res: Response, next: NextFunction) => {
  return validateRequest(educationalResourceQuerySchema)(req, res, next);
};

// Educational Resource Category Assignment validation middleware
export const validateAssignResourceToCategory = (req: Request, res: Response, next: NextFunction) => {
  return validateRequest(assignResourceToCategorySchema)(req, res, next);
}; 