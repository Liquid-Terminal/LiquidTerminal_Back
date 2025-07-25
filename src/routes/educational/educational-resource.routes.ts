import express, { Request, Response, RequestHandler } from "express";
import { EducationalResourceService } from "../../services/educational/educational-resource.service";
import { marketRateLimiter } from '../../middleware/apiRateLimiter';
import { validatePrivyToken } from '../../middleware/authMiddleware';
import { requireModerator, requireAdmin } from '../../middleware/roleMiddleware';
import { validateGetRequest } from '../../middleware/validation';
import {
  validateCreateEducationalResource,
  validateUpdateEducationalResource,
  validateAssignResourceToCategory,
} from '../../middleware/validation';
import {
  educationalResourcesGetSchema,
  educationalResourceByIdGetSchema,
  educationalResourcesByCategoryGetSchema
} from '../../schemas/educational.schema';
import { EducationalError } from '../../errors/educational.errors';
import { logDeduplicator } from '../../utils/logDeduplicator';

const router = express.Router();
const educationalResourceService = new EducationalResourceService();

// Appliquer le rate limiting à toutes les routes
router.use(marketRateLimiter);

// Route pour créer une nouvelle ressource éducative
router.post('/', validatePrivyToken, requireModerator, validateCreateEducationalResource, (async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
        code: 'UNAUTHENTICATED'
      });
    }

    const resourceData = { ...req.body, addedBy: userId };
    const resource = await educationalResourceService.create(resourceData);
    
    res.status(201).json({
      success: true,
      message: 'Educational resource created successfully',
      data: resource
    });
  } catch (error) {
    logDeduplicator.error('Error creating educational resource:', { error, body: req.body });
    
    if (error instanceof EducationalError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
}) as RequestHandler);

// Route pour récupérer toutes les ressources éducatives
router.get('/', validateGetRequest(educationalResourcesGetSchema), (async (req: Request, res: Response) => {
  try {
    const resources = await educationalResourceService.getAll(req.query);
    res.json({
      success: true,
      data: resources.data,
      pagination: resources.pagination
    });
  } catch (error) {
    logDeduplicator.error('Error fetching educational resources:', { error });
    
    if (error instanceof EducationalError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
}) as RequestHandler);

// Route pour récupérer une ressource éducative par son ID
router.get('/:id', validateGetRequest(educationalResourceByIdGetSchema), (async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format',
        code: 'INVALID_ID_FORMAT'
      });
    }

    const resource = await educationalResourceService.getById(id);
    res.json({
      success: true,
      data: resource
    });
  } catch (error) {
    logDeduplicator.error('Error fetching educational resource:', { error, id: req.params.id });
    
    if (error instanceof EducationalError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
}) as RequestHandler);

// Route pour mettre à jour une ressource éducative
router.put('/:id', validatePrivyToken, requireModerator, validateUpdateEducationalResource, (async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format',
        code: 'INVALID_ID_FORMAT'
      });
    }

    const resource = await educationalResourceService.update(id, req.body);
    res.json({
      success: true,
      message: 'Educational resource updated successfully',
      data: resource
    });
  } catch (error) {
    logDeduplicator.error('Error updating educational resource:', { error, id: req.params.id, body: req.body });
    
    if (error instanceof EducationalError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
}) as RequestHandler);

// Route pour supprimer une ressource éducative
router.delete('/:id', validatePrivyToken, requireAdmin, (async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format',
        code: 'INVALID_ID_FORMAT'
      });
    }

    await educationalResourceService.delete(id);
    res.json({
      success: true,
      message: 'Educational resource deleted successfully'
    });
  } catch (error) {
    logDeduplicator.error('Error deleting educational resource:', { error, id: req.params.id });
    
    if (error instanceof EducationalError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
}) as RequestHandler);

// Route pour assigner une ressource à une catégorie
router.post('/:id/categories', validatePrivyToken, validateAssignResourceToCategory, (async (req: Request, res: Response) => {
  try {
    const resourceId = parseInt(req.params.id, 10);
    if (isNaN(resourceId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid resource ID format',
        code: 'INVALID_ID_FORMAT'
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
        code: 'UNAUTHENTICATED'
      });
    }

    const { categoryId } = req.body;
    await educationalResourceService.assignToCategory({
      resourceId,
      categoryId,
      assignedBy: userId
    });
    
    res.json({
      success: true,
      message: 'Resource assigned to category successfully'
    });
  } catch (error) {
    logDeduplicator.error('Error assigning resource to category:', { 
      error, 
      resourceId: req.params.id, 
      categoryId: req.body.categoryId 
    });
    
    if (error instanceof EducationalError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
}) as RequestHandler);

// Route pour retirer une ressource d'une catégorie
router.delete('/:id/categories/:categoryId', validatePrivyToken, (async (req: Request, res: Response) => {
  try {
    const resourceId = parseInt(req.params.id, 10);
    const categoryId = parseInt(req.params.categoryId, 10);
    
    if (isNaN(resourceId) || isNaN(categoryId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format',
        code: 'INVALID_ID_FORMAT'
      });
    }

    await educationalResourceService.removeFromCategory(resourceId, categoryId);
    
    res.json({
      success: true,
      message: 'Resource removed from category successfully'
    });
  } catch (error) {
    logDeduplicator.error('Error removing resource from category:', { 
      error, 
      resourceId: req.params.id, 
      categoryId: req.params.categoryId 
    });
    
    if (error instanceof EducationalError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
}) as RequestHandler);

// Route pour récupérer les ressources d'une catégorie spécifique
router.get('/category/:categoryId', validateGetRequest(educationalResourcesByCategoryGetSchema), (async (req: Request, res: Response) => {
  try {
    const categoryId = parseInt(req.params.categoryId, 10);
    if (isNaN(categoryId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category ID format',
        code: 'INVALID_CATEGORY_ID_FORMAT'
      });
    }

    const resources = await educationalResourceService.getResourcesByCategory(categoryId);
    res.json({
      success: true,
      data: resources
    });
  } catch (error) {
    logDeduplicator.error('Error fetching resources by category:', { error, categoryId: req.params.categoryId });
    
    if (error instanceof EducationalError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
}) as RequestHandler);

export default router; 