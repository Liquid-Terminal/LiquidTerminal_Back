import { validateRequest, validateParam, validateBody, validateGetRequest } from './validation.middleware';
import { sanitizeInput } from './sanitization.middleware';
import {
  validateCreateEducationalCategory,
  validateUpdateEducationalCategory,
  validateEducationalCategoryQuery,
  validateCreateEducationalResource,
  validateUpdateEducationalResource,
  validateEducationalResourceQuery,
  validateAssignResourceToCategory
} from './educational.validation';

export {
  validateRequest,
  validateGetRequest,
  validateParam,
  validateBody,
  sanitizeInput,
  validateCreateEducationalCategory,
  validateUpdateEducationalCategory,
  validateEducationalCategoryQuery,
  validateCreateEducationalResource,
  validateUpdateEducationalResource,
  validateEducationalResourceQuery,
  validateAssignResourceToCategory
}; 