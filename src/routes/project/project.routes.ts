import express, { Request, Response, RequestHandler } from "express";
import { ProjectService } from "../../services/project/project.service";
import { validateRequest } from '../../middleware/validation/validation.middleware';
import {  projectCategoryUpdateSchema } from '../../schemas/project.schema';
import { marketRateLimiter } from '../../middleware/apiRateLimiter';
import { ProjectNotFoundError, CategoryNotFoundError } from '../../errors/project.errors';
import { logDeduplicator } from '../../utils/logDeduplicator';
import { ProjectError } from '../../errors/project.errors';

const router = express.Router();
const projectService = new ProjectService();

// Appliquer le rate limiting à toutes les routes
router.use(marketRateLimiter);

// Route pour créer un nouveau projet
router.post('/', (async (req: Request, res: Response) => {
  try {
    const project = await projectService.create(req.body);
    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: project
    });
  } catch (error) {
    logDeduplicator.error('Error creating project:', { error, body: req.body });
    
    if (error instanceof ProjectError) {
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

// Route pour récupérer tous les projets
router.get('/', (async (req: Request, res: Response) => {
  try {
    const projects = await projectService.getAll(req.query);
    res.json({
      success: true,
      data: projects.data,
      pagination: projects.pagination
    });
  } catch (error) {
    logDeduplicator.error('Error fetching projects:', { error });
    
    if (error instanceof ProjectError) {
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

// Route pour récupérer un projet par son ID
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

    const project = await projectService.getById(id);
    res.json({
      success: true,
      data: project
    });
  } catch (error) {
    logDeduplicator.error('Error fetching project:', { error, id: req.params.id });
    
    if (error instanceof ProjectError) {
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

// Route pour mettre à jour un projet
router.put('/:id', (async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format',
        code: 'INVALID_ID_FORMAT'
      });
    }

    const project = await projectService.update(id, req.body);
    res.json({
      success: true,
      message: 'Project updated successfully',
      data: project
    });
  } catch (error) {
    logDeduplicator.error('Error updating project:', { error, id: req.params.id, body: req.body });
    
    if (error instanceof ProjectError) {
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

// Route pour supprimer un projet
router.delete('/:id', (async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format',
        code: 'INVALID_ID_FORMAT'
      });
    }

    await projectService.delete(id);
    res.json({
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (error) {
    logDeduplicator.error('Error deleting project:', { error, id: req.params.id });
    
    if (error instanceof ProjectError) {
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

// Mettre à jour la catégorie d'un projet
router.put("/:id/category", validateRequest(projectCategoryUpdateSchema), (async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      logDeduplicator.warn('Invalid project ID provided', { id: req.params.id });
      return res.status(400).json({ message: "ID de projet invalide" });
    }
    
    const { categoryId } = req.body;
    const project = await projectService.updateProjectCategory(
      projectId, 
      categoryId
    );
    
    logDeduplicator.info('Project category updated successfully', { 
      projectId: project.id,
      title: project.title,
      categoryId: project.categoryId
    });
    
    res.json(project);
  } catch (error) {
    if (error instanceof ProjectNotFoundError) {
      logDeduplicator.warn('Project not found for category update', { projectId: req.params.id });
      return res.status(404).json({ message: error.message });
    }
    
    if (error instanceof CategoryNotFoundError) {
      logDeduplicator.warn('Category not found for project update', { 
        projectId: req.params.id,
        categoryId: req.body.categoryId
      });
      return res.status(404).json({ message: error.message });
    }
    
    logDeduplicator.error('Error updating project category:', { 
      error, 
      projectId: req.params.id,
      categoryId: req.body.categoryId
    });
    res.status(500).json({ message: 'Internal server error' });
  }
}) as RequestHandler);

// Récupérer tous les projets d'une catégorie
router.get("/category/:categoryId", (async (req: Request, res: Response) => {
  try {
    const categoryId = parseInt(req.params.categoryId);
    if (isNaN(categoryId)) {
      logDeduplicator.warn('Invalid category ID provided', { id: req.params.categoryId });
      return res.status(400).json({ message: "ID de catégorie invalide" });
    }
    
    const projects = await projectService.getProjectsByCategory(categoryId);
    logDeduplicator.info('Projects by category retrieved successfully', { 
      categoryId,
      count: projects.length
    });
    
    res.json(projects);
  } catch (error) {
    if (error instanceof CategoryNotFoundError) {
      logDeduplicator.warn('Category not found', { categoryId: req.params.categoryId });
      return res.status(404).json({ message: error.message });
    }
    
    logDeduplicator.error('Error fetching projects by category:', { 
      error, 
      categoryId: req.params.categoryId
    });
    res.status(500).json({ message: 'Internal server error' });
  }
}) as RequestHandler);

export default router; 