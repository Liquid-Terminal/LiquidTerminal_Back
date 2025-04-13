import { Router, Request, Response, RequestHandler } from 'express';
import { CategoryService } from '../../services/project/category.service';
import { CategoryCreateInput, CategoryUpdateInput } from '../../types/project.types';
import { validateRequest } from '../../middleware/validation/validation.middleware';
import { categoryQuerySchema, categoryCreateSchema, categoryUpdateSchema } from '../../schemas/category.schema';
import { marketRateLimiter } from '../../middleware/apiRateLimiter';
import { logger } from '../../utils/logger';
import { CategoryNotFoundError, CategoryAlreadyExistsError } from '../../errors/project.errors';

const router = Router();
const categoryService = new CategoryService();

// Appliquer le rate limiting à toutes les routes
router.use(marketRateLimiter);

// GET /api/categories
router.get('/', validateRequest(categoryQuerySchema), async (req, res) => {
  try {
    const { page, limit, sort, order, search } = req.query;
    
    const result = await categoryService.getAllCategories({
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      sort: sort as string,
      order: order as 'asc' | 'desc',
      search: search as string
    });

    res.json(result);
  } catch (error) {
    logger.error('Error fetching categories:', { error, query: req.query });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Récupérer une catégorie par son ID
router.get('/:id', (async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      logger.warn('Invalid category ID provided', { id: req.params.id });
      return res.status(400).json({ message: 'ID de catégorie invalide' });
    }
    
    const category = await categoryService.getCategoryById(id);
    res.json(category);
  } catch (error) {
    if (error instanceof CategoryNotFoundError) {
      logger.warn('Category not found', { categoryId: req.params.id });
      return res.status(404).json({ message: error.message });
    }
    
    logger.error('Error fetching category:', { error, categoryId: req.params.id });
    res.status(500).json({ message: 'Internal server error' });
  }
}) as RequestHandler);

// Récupérer une catégorie avec ses projets
router.get('/:id/projects', (async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      logger.warn('Invalid category ID provided', { id: req.params.id });
      return res.status(400).json({ message: 'ID de catégorie invalide' });
    }
    
    const categoryWithProjects = await categoryService.getCategoryWithProjects(id);
    res.json(categoryWithProjects);
  } catch (error) {
    if (error instanceof CategoryNotFoundError) {
      logger.warn('Category not found', { categoryId: req.params.id });
      return res.status(404).json({ message: error.message });
    }
    
    logger.error('Error fetching category with projects:', { error, categoryId: req.params.id });
    res.status(500).json({ message: 'Internal server error' });
  }
}) as RequestHandler);

// Créer une nouvelle catégorie
router.post('/', validateRequest(categoryCreateSchema), (async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body as CategoryCreateInput;
    
    if (!name) {
      logger.warn('Category creation failed: Name is required');
      return res.status(400).json({ message: 'Le nom de la catégorie est requis' });
    }
    
    const newCategory = await categoryService.createCategory({ name, description });
    res.status(201).json(newCategory);
  } catch (error) {
    if (error instanceof CategoryAlreadyExistsError) {
      logger.warn('Category creation failed: Category already exists', { 
        name: req.body.name 
      });
      return res.status(400).json({ message: error.message });
    }
    
    logger.error('Error creating category:', { error, body: req.body });
    res.status(500).json({ message: 'Internal server error' });
  }
}) as RequestHandler);

// Mettre à jour une catégorie
router.put('/:id', validateRequest(categoryUpdateSchema), (async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      logger.warn('Invalid category ID provided', { id: req.params.id });
      return res.status(400).json({ message: 'ID de catégorie invalide' });
    }
    
    const { name, description } = req.body as CategoryUpdateInput;
    
    if (!name && description === undefined) {
      logger.warn('Category update failed: No data to update', { 
        categoryId: id,
        body: req.body
      });
      return res.status(400).json({ message: 'Aucune donnée à mettre à jour' });
    }
    
    const updatedCategory = await categoryService.updateCategory(id, { name, description });
    res.json(updatedCategory);
  } catch (error) {
    if (error instanceof CategoryNotFoundError) {
      logger.warn('Category not found for update', { categoryId: req.params.id });
      return res.status(404).json({ message: error.message });
    }
    
    if (error instanceof CategoryAlreadyExistsError) {
      logger.warn('Category update failed: Category already exists', { 
        categoryId: req.params.id,
        name: req.body.name
      });
      return res.status(400).json({ message: error.message });
    }
    
    logger.error('Error updating category:', { error, categoryId: req.params.id, body: req.body });
    res.status(500).json({ message: 'Internal server error' });
  }
}) as RequestHandler);

// Supprimer une catégorie
router.delete('/:id', (async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      logger.warn('Invalid category ID provided', { id: req.params.id });
      return res.status(400).json({ message: 'ID de catégorie invalide' });
    }
    
    await categoryService.deleteCategory(id);
    res.status(204).send();
  } catch (error) {
    if (error instanceof CategoryNotFoundError) {
      logger.warn('Category not found for deletion', { categoryId: req.params.id });
      return res.status(404).json({ message: error.message });
    }
    
    logger.error('Error deleting category:', { error, categoryId: req.params.id });
    res.status(500).json({ message: 'Internal server error' });
  }
}) as RequestHandler);

export default router;