import express, { Request, Response, RequestHandler } from "express";
import { ProjectService } from "../services/project.service";

const router = express.Router();
const projectService = new ProjectService();

// Créer un nouveau projet
router.post("/", (async (req: Request, res: Response) => {
  try {
    const project = await projectService.createProject(req.body);
    res.status(201).json(project);
  } catch (error: any) {
    console.error("Erreur lors de la création du projet:", error);
    res.status(error.message === "Un projet avec ce titre existe déjà" ? 400 : 500)
      .json({ message: error.message || "Erreur interne du serveur" });
  }
}) as RequestHandler);

// Récupérer tous les projets
router.get("/", (async (_req: Request, res: Response) => {
  try {
    console.log('Route GET /projects appelée');
    const projects = await projectService.getAllProjects();
    console.log('Projets récupérés avec succès');
    res.json(projects);
  } catch (error) {
    console.error("Erreur détaillée lors de la récupération des projets:", {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({ 
      message: "Erreur interne du serveur",
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

// Récupérer un projet par son ID
router.get("/:id", (async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const project = await projectService.getProjectById(id);
    res.json(project);
  } catch (error: any) {
    console.error("Erreur lors de la récupération du projet:", error);
    res.status(error.message === "Projet non trouvé" ? 404 : 500)
      .json({ message: error.message || "Erreur interne du serveur" });
  }
}) as RequestHandler);

// Mettre à jour un projet
router.put("/:id", (async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const project = await projectService.updateProject(id, req.body);
    res.json(project);
  } catch (error: any) {
    console.error("Erreur lors de la mise à jour du projet:", error);
    res.status(error.message === "Projet non trouvé" ? 404 : 500)
      .json({ message: error.message || "Erreur interne du serveur" });
  }
}) as RequestHandler);

// Supprimer un projet
router.delete("/:id", (async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    await projectService.deleteProject(id);
    res.status(204).send();
  } catch (error: any) {
    console.error("Erreur lors de la suppression du projet:", error);
    res.status(error.message === "Projet non trouvé" ? 404 : 500)
      .json({ message: error.message || "Erreur interne du serveur" });
  }
}) as RequestHandler);

export default router; 