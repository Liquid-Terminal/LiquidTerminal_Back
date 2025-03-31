import { Router, Request, Response, RequestHandler } from 'express';
import { CategoryService } from '../../services/project/category.service';
import { CategoryCreateInput, CategoryUpdateInput } from '../../types/category.types';

const router = Router();
const categoryService = new CategoryService();

// Récupérer toutes les catégories
router.get('/', (async (_req: Request, res: Response) => {
  try {
    const categories = await categoryService.getAllCategories();
    res.json(categories);
  } catch (error) {
    console.error('Erreur lors de la récupération des catégories:', error);
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
}) as RequestHandler);

// Récupérer une catégorie par son ID
router.get('/:id', (async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: 'ID de catégorie invalide' });
    }
    
    const category = await categoryService.getCategoryById(id);
    
    if (!category) {
      return res.status(404).json({ message: 'Catégorie non trouvée' });
    }
    
    res.json(category);
  } catch (error) {
    console.error('Erreur lors de la récupération de la catégorie:', error);
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
}) as RequestHandler);

// Récupérer une catégorie avec ses projets
router.get('/:id/projects', (async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: 'ID de catégorie invalide' });
    }
    
    const categoryWithProjects = await categoryService.getCategoryWithProjects(id);
    
    if (!categoryWithProjects) {
      return res.status(404).json({ message: 'Catégorie non trouvée' });
    }
    
    res.json(categoryWithProjects);
  } catch (error) {
    console.error('Erreur lors de la récupération de la catégorie avec projets:', error);
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
}) as RequestHandler);

// Créer une nouvelle catégorie
router.post('/', (async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body as CategoryCreateInput;
    
    if (!name) {
      return res.status(400).json({ message: 'Le nom de la catégorie est requis' });
    }
    
    const newCategory = await categoryService.createCategory({ name, description });
    res.status(201).json(newCategory);
  } catch (error) {
    console.error('Erreur lors de la création de la catégorie:', error);
    
    // Vérifier si l'erreur est due à un nom de catégorie déjà existant
    if (error instanceof Error && error.message.includes('Unique constraint failed')) {
      return res.status(400).json({ message: 'Une catégorie avec ce nom existe déjà' });
    }
    
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
}) as RequestHandler);

// Mettre à jour une catégorie
router.put('/:id', (async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: 'ID de catégorie invalide' });
    }
    
    const { name, description } = req.body as CategoryUpdateInput;
    
    if (!name && description === undefined) {
      return res.status(400).json({ message: 'Aucune donnée à mettre à jour' });
    }
    
    const updatedCategory = await categoryService.updateCategory(id, { name, description });
    res.json(updatedCategory);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la catégorie:', error);
    
    // Vérifier si l'erreur est due à un nom de catégorie déjà existant
    if (error instanceof Error && error.message.includes('Unique constraint failed')) {
      return res.status(400).json({ message: 'Une catégorie avec ce nom existe déjà' });
    }
    
    // Vérifier si l'erreur est due à une catégorie non trouvée
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return res.status(404).json({ message: 'Catégorie non trouvée' });
    }
    
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
}) as RequestHandler);

// Supprimer une catégorie
router.delete('/:id', (async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: 'ID de catégorie invalide' });
    }
    
    await categoryService.deleteCategory(id);
    res.status(204).send();
  } catch (error) {
    console.error('Erreur lors de la suppression de la catégorie:', error);
    
    // Vérifier si l'erreur est due à une catégorie non trouvée
    if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
      return res.status(404).json({ message: 'Catégorie non trouvée' });
    }
    
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
}) as RequestHandler);

export default router;