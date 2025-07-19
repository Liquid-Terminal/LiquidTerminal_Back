import express, { Request, Response, RequestHandler } from "express";
import { ReadListService } from "../../services/readlist/readlist.service";
import { marketRateLimiter } from '../../middleware/apiRateLimiter';
import { validatePrivyToken } from '../../middleware/authMiddleware';
import {
  validateCreateReadList,
  validateUpdateReadList,
  validateGetReadList,
  validateReadListQuery
} from '../../middleware/validation/readlist.validation';
import { ReadListError } from '../../errors/readlist.errors';
import { logDeduplicator } from '../../utils/logDeduplicator';

const router = express.Router();
const readListService = new ReadListService();

// Appliquer le rate limiting à toutes les routes
router.use(marketRateLimiter);

// Route pour créer une nouvelle read list
router.post('/', validatePrivyToken, validateCreateReadList, (async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
        code: 'UNAUTHENTICATED'
      });
    }

    const readListData = { ...req.body, userId };
    const readList = await readListService.create(readListData);
    
    res.status(201).json({
      success: true,
      message: 'Read list created successfully',
      data: readList
    });
  } catch (error) {
    logDeduplicator.error('Error creating read list:', { error, body: req.body });
    
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

// Route pour récupérer toutes les read lists (avec filtres)
router.get('/', validateReadListQuery, (async (req: Request, res: Response) => {
  try {
    const readLists = await readListService.getAll(req.query);
    res.json({
      success: true,
      data: readLists.data,
      pagination: readLists.pagination
    });
  } catch (error) {
    logDeduplicator.error('Error fetching read lists:', { error });
    
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

// Route pour récupérer les read lists publiques
router.get('/public', validateReadListQuery, (async (req: Request, res: Response) => {
  try {
    const publicLists = await readListService.getPublicLists(req.query);
    res.json({
      success: true,
      data: publicLists.data,
      pagination: publicLists.pagination
    });
  } catch (error) {
    logDeduplicator.error('Error fetching public read lists:', { error });
    
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

// Route pour récupérer les read lists d'un utilisateur
router.get('/my-lists', validatePrivyToken, (async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
        code: 'UNAUTHENTICATED'
      });
    }

    const readLists = await readListService.getByUser(userId);
    res.json({
      success: true,
      data: readLists
    });
  } catch (error) {
    logDeduplicator.error('Error fetching user read lists:', { error, userId: req.user?.id });
    
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

// Route pour récupérer une read list par son ID
router.get('/:id', validateGetReadList, (async (req: Request, res: Response) => {
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
    let readList;

    if (userId) {
      // Si l'utilisateur est authentifié, vérifier les permissions
      readList = await readListService.getByIdWithPermission(id, userId);
    } else {
      // Si pas authentifié, récupérer seulement si publique
      readList = await readListService.getById(id);
      if (!readList.isPublic) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to private read list',
          code: 'ACCESS_DENIED'
        });
      }
    }

    res.json({
      success: true,
      data: readList
    });
  } catch (error) {
    logDeduplicator.error('Error fetching read list:', { error, id: req.params.id });
    
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

// Route pour mettre à jour une read list
router.put('/:id', validatePrivyToken, validateUpdateReadList, (async (req: Request, res: Response) => {
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

    // Vérifier d'abord que l'utilisateur a accès à cette read list
    await readListService.getByIdWithPermission(id, userId);
    
    const readList = await readListService.update(id, req.body);
    res.json({
      success: true,
      message: 'Read list updated successfully',
      data: readList
    });
  } catch (error) {
    logDeduplicator.error('Error updating read list:', { error, id: req.params.id, body: req.body });
    
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

// Route pour supprimer une read list
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

    // Vérifier d'abord que l'utilisateur a accès à cette read list
    await readListService.getByIdWithPermission(id, userId);
    
    await readListService.delete(id);
    res.json({
      success: true,
      message: 'Read list deleted successfully'
    });
  } catch (error) {
    logDeduplicator.error('Error deleting read list:', { error, id: req.params.id });
    
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