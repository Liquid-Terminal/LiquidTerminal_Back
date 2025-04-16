import express, { Request, Response, RequestHandler } from "express";
import { ProjectService } from "../../services/project/project.service";
import { validateRequest } from '../../middleware/validation/validation.middleware';
import { 
  projectQuerySchema, 
  projectCreateSchema, 
  projectUpdateSchema,
  projectCategoryUpdateSchema 
} from '../../schemas/project.schema';
import { marketRateLimiter } from '../../middleware/apiRateLimiter';
import { logger } from '../../utils/logger';
import { 
  ProjectNotFoundError, 
  ProjectAlreadyExistsError,
  CategoryNotFoundError 
} from '../../errors/project.errors';
import { logDeduplicator } from '../../utils/logDeduplicator';

const router = express.Router();
const projectService = new ProjectService();

// Appliquer le rate limiting à toutes les routes
router.use(marketRateLimiter);

// Créer un nouveau projet
router.post("/", validateRequest(projectCreateSchema), (async (req: Request, res: Response) => {
  try {
    const project = await projectService.createProject(req.body);
    logDeduplicator.info('Project created successfully', { 
      projectId: project.id,
      title: project.title
    });
    res.status(201).json(project);
  } catch (error) {
    if (error instanceof ProjectAlreadyExistsError) {
      logger.warn('Project creation failed: Project already exists', { 
        title: req.body.title 
      });
      return res.status(400).json({ message: error.message });
    }
    
    logger.error('Project creation failed:', { error, body: req.body });
    res.status(500).json({ message: 'Internal server error' });
  }
}) as RequestHandler);

// Récupérer tous les projets
router.get("/", validateRequest(projectQuerySchema), async (req, res) => {
  try {
    const { page, limit, sort, order, search } = req.query;
    
    const result = await projectService.getAllProjects({
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      sort: sort as string,
      order: order as 'asc' | 'desc',
      search: search as string
    });

    logDeduplicator.info('Projects retrieved successfully', { 
      count: result.data.length,
      total: result.pagination.total,
      page: page || 1,
      limit: limit || 10
    });
    
    res.json(result);
  } catch (error) {
    logger.error('Error fetching projects:', { error, query: req.query });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Récupérer un projet par son ID
router.get("/:id", (async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      logger.warn('Invalid project ID provided', { id: req.params.id });
      return res.status(400).json({ message: "ID de projet invalide" });
    }
    
    const project = await projectService.getProjectById(id);
    logDeduplicator.info('Project retrieved successfully', { 
      projectId: project.id,
      title: project.title
    });
    
    res.json(project);
  } catch (error) {
    if (error instanceof ProjectNotFoundError) {
      logger.warn('Project not found', { projectId: req.params.id });
      return res.status(404).json({ message: error.message });
    }
    
    logger.error('Error fetching project:', { error, projectId: req.params.id });
    res.status(500).json({ message: 'Internal server error' });
  }
}) as RequestHandler);

// Mettre à jour un projet
router.put("/:id", validateRequest(projectUpdateSchema), (async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      logger.warn('Invalid project ID provided', { id: req.params.id });
      return res.status(400).json({ message: "ID de projet invalide" });
    }
    
    const project = await projectService.updateProject(id, req.body);
    logDeduplicator.info('Project updated successfully', { 
      projectId: project.id,
      title: project.title
    });
    
    res.json(project);
  } catch (error) {
    if (error instanceof ProjectNotFoundError) {
      logger.warn('Project not found for update', { projectId: req.params.id });
      return res.status(404).json({ message: error.message });
    }
    
    logger.error('Error updating project:', { error, projectId: req.params.id, body: req.body });
    res.status(500).json({ message: 'Internal server error' });
  }
}) as RequestHandler);

// Supprimer un projet
router.delete("/:id", (async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      logger.warn('Invalid project ID provided', { id: req.params.id });
      return res.status(400).json({ message: "ID de projet invalide" });
    }
    
    await projectService.deleteProject(id);
    logDeduplicator.info('Project deleted successfully', { projectId: id });
    
    res.status(204).send();
  } catch (error) {
    if (error instanceof ProjectNotFoundError) {
      logger.warn('Project not found for deletion', { projectId: req.params.id });
      return res.status(404).json({ message: error.message });
    }
    
    logger.error('Error deleting project:', { error, projectId: req.params.id });
    res.status(500).json({ message: 'Internal server error' });
  }
}) as RequestHandler);

// Mettre à jour la catégorie d'un projet
router.put("/:id/category", validateRequest(projectCategoryUpdateSchema), (async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      logger.warn('Invalid project ID provided', { id: req.params.id });
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
      logger.warn('Project not found for category update', { projectId: req.params.id });
      return res.status(404).json({ message: error.message });
    }
    
    if (error instanceof CategoryNotFoundError) {
      logger.warn('Category not found for project update', { 
        projectId: req.params.id,
        categoryId: req.body.categoryId
      });
      return res.status(404).json({ message: error.message });
    }
    
    logger.error('Error updating project category:', { 
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
      logger.warn('Invalid category ID provided', { id: req.params.categoryId });
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
      logger.warn('Category not found', { categoryId: req.params.categoryId });
      return res.status(404).json({ message: error.message });
    }
    
    logger.error('Error fetching projects by category:', { 
      error, 
      categoryId: req.params.categoryId
    });
    res.status(500).json({ message: 'Internal server error' });
  }
}) as RequestHandler);

export default router; 