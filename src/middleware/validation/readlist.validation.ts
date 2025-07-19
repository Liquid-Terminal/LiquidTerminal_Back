import { Request, Response, NextFunction } from 'express';
import { validateRequest } from './validation.middleware';
import {
  createReadListSchema,
  updateReadListSchema,
  getReadListSchema,
  createReadListItemSchema,
  updateReadListItemSchema,
  getReadListItemsSchema,
  addResourceToReadListSchema,
  readListQuerySchema,
  readListItemQuerySchema
} from '../../schemas/readlist.schema';

// ReadList validation middleware
export const validateCreateReadList = (req: Request, res: Response, next: NextFunction) => {
  return validateRequest(createReadListSchema)(req, res, next);
};

export const validateUpdateReadList = (req: Request, res: Response, next: NextFunction) => {
  return validateRequest(updateReadListSchema)(req, res, next);
};

export const validateGetReadList = (req: Request, res: Response, next: NextFunction) => {
  return validateRequest(getReadListSchema)(req, res, next);
};

export const validateReadListQuery = (req: Request, res: Response, next: NextFunction) => {
  return validateRequest(readListQuerySchema)(req, res, next);
};

// ReadListItem validation middleware
export const validateCreateReadListItem = (req: Request, res: Response, next: NextFunction) => {
  return validateRequest(createReadListItemSchema)(req, res, next);
};

export const validateUpdateReadListItem = (req: Request, res: Response, next: NextFunction) => {
  return validateRequest(updateReadListItemSchema)(req, res, next);
};

export const validateGetReadListItems = (req: Request, res: Response, next: NextFunction) => {
  return validateRequest(getReadListItemsSchema)(req, res, next);
};

export const validateReadListItemQuery = (req: Request, res: Response, next: NextFunction) => {
  return validateRequest(readListItemQuerySchema)(req, res, next);
};

export const validateAddResourceToReadList = (req: Request, res: Response, next: NextFunction) => {
  return validateRequest(addResourceToReadListSchema)(req, res, next);
}; 