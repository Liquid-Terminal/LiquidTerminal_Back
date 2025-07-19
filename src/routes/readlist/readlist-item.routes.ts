import express, { Request, Response, RequestHandler } from "express";
import { ReadListItemService } from "../../services/readlist/readlist-item.service";
import { marketRateLimiter } from '../../middleware/apiRateLimiter';
import { validatePrivyToken } from '../../middleware/authMiddleware';
import {
  validateCreateReadListItem,
  validateUpdateReadListItem,
  validateGetReadListItems,
  validateAddResourceToReadList,
  validateReadListItemQuery
} from '../../middleware/validation/readlist.validation';
import { ReadListError } from '../../errors/readlist.errors';
import { logDeduplicator } from '../../utils/logDeduplicator';

const router = express.Router();
const readListItemService = new ReadListItemService();

// Appliquer le rate limiting à toutes les routes
router.use(marketRateLimiter);

// Route pour ajouter une ressource à une read list
router.post('/', validatePrivyToken, validateCreateReadListItem, (async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
        code: 'UNAUTHENTICATED'
      });
    }

    const item = await readListItemService.addResourceToReadList(req.body, userId);
    
    res.status(201).json({
      success: true,
      message: 'Resource added to read list successfully',
      data: item
    });
  } catch (error) {
    logDeduplicator.error('Error adding resource to read list:', { error, body: req.body });
    
    if (error instanceof ReadListError) {
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

// Route pour récupérer tous les items (avec filtres)
router.get('/', validateReadListItemQuery, (async (req: Request, res: Response) => {
  try {
    const items = await readListItemService.getAll(req.query);
    res.json({
      success: true,
      data: items.data,
      pagination: items.pagination
    });
  } catch (error) {
    logDeduplicator.error('Error fetching read list items:', { error });
    
    if (error instanceof ReadListError) {
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

// Route pour récupérer un item par son ID
router.get('/:id', (async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format',
        code: 'INVALID_ID_FORMAT'
      });
    }

    const item = await readListItemService.getById(id);
    res.json({
      success: true,
      data: item
    });
  } catch (error) {
    logDeduplicator.error('Error fetching read list item:', { error, id: req.params.id });
    
    if (error instanceof ReadListError) {
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

// Route pour mettre à jour un item
router.put('/:id', validatePrivyToken, validateUpdateReadListItem, (async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format',
        code: 'INVALID_ID_FORMAT'
      });
    }

    const item = await readListItemService.update(id, req.body);
    res.json({
      success: true,
      message: 'Read list item updated successfully',
      data: item
    });
  } catch (error) {
    logDeduplicator.error('Error updating read list item:', { error, id: req.params.id, body: req.body });
    
    if (error instanceof ReadListError) {
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

// Route pour supprimer un item
router.delete('/:id', validatePrivyToken, (async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format',
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

    await readListItemService.deleteWithPermission(id, userId);
    res.json({
      success: true,
      message: 'Read list item deleted successfully'
    });
  } catch (error) {
    logDeduplicator.error('Error deleting read list item:', { error, id: req.params.id });
    
    if (error instanceof ReadListError) {
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

// Route pour marquer un item comme lu/non lu
router.patch('/:id/read-status', validatePrivyToken, (async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format',
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

    const { isRead } = req.body;
    if (typeof isRead !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isRead must be a boolean',
        code: 'INVALID_READ_STATUS'
      });
    }

    const item = await readListItemService.toggleReadStatus(id, userId, isRead);
    res.json({
      success: true,
      message: `Item marked as ${isRead ? 'read' : 'unread'}`,
      data: item
    });
  } catch (error) {
    logDeduplicator.error('Error toggling read status:', { error, id: req.params.id, body: req.body });
    
    if (error instanceof ReadListError) {
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

// Route pour récupérer les items d'une read list spécifique
router.get('/by-list/:readListId', validateGetReadListItems, (async (req: Request, res: Response) => {
  try {
    const readListId = parseInt(req.params.readListId, 10);
    if (isNaN(readListId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid read list ID format',
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

    const items = await readListItemService.getByReadListWithPermission(readListId, userId, req.query);
    res.json({
      success: true,
      data: items.data,
      pagination: items.pagination
    });
  } catch (error) {
    logDeduplicator.error('Error fetching items by read list:', { error, readListId: req.params.readListId });
    
    if (error instanceof ReadListError) {
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

// Route pour réorganiser les items d'une read list
router.post('/reorder/:readListId', validatePrivyToken, (async (req: Request, res: Response) => {
  try {
    const readListId = parseInt(req.params.readListId, 10);
    if (isNaN(readListId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid read list ID format',
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

    const { itemOrders } = req.body;
    if (!Array.isArray(itemOrders)) {
      return res.status(400).json({
        success: false,
        error: 'itemOrders must be an array',
        code: 'INVALID_ITEM_ORDERS'
      });
    }

    // Valider le format des itemOrders
    const isValidFormat = itemOrders.every(item => 
      typeof item === 'object' && 
      typeof item.id === 'number' && 
      typeof item.order === 'number'
    );

    if (!isValidFormat) {
      return res.status(400).json({
        success: false,
        error: 'Each item order must have id and order properties',
        code: 'INVALID_ITEM_ORDER_FORMAT'
      });
    }

    await readListItemService.reorderItems(readListId, userId, itemOrders);
    res.json({
      success: true,
      message: 'Items reordered successfully'
    });
  } catch (error) {
    logDeduplicator.error('Error reordering items:', { error, readListId: req.params.readListId, body: req.body });
    
    if (error instanceof ReadListError) {
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