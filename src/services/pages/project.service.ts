import prisma from "../../lib/prisma";
import { CreateProjectDto } from "../../types/project.types";

export class ProjectService {
  public async createProject(projectData: CreateProjectDto) {
    const existingProject = await prisma.project.findUnique({
      where: { title: projectData.title }
    });

    if (existingProject) {
      throw new Error("Un projet avec ce titre existe déjà");
    }

    return await prisma.project.create({
      data: projectData
    });
  }

  public async getAllProjects() {
    try {
      console.log('Tentative de récupération des projets...');
      const projects = await prisma.project.findMany({
        orderBy: {
          createdAt: 'desc'
        }
      });
      console.log('Projets récupérés:', projects);
      return projects;
    } catch (error) {
      console.error('Erreur détaillée lors de la récupération des projets:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  public async getProjectById(id: number) {
    const project = await prisma.project.findUnique({
      where: { id }
    });

    if (!project) {
      throw new Error("Projet non trouvé");
    }

    return project;
  }

  public async updateProject(id: number, projectData: Partial<CreateProjectDto>) {
    const project = await prisma.project.findUnique({
      where: { id }
    });

    if (!project) {
      throw new Error("Projet non trouvé");
    }

    return await prisma.project.update({
      where: { id },
      data: projectData
    });
  }

  public async deleteProject(id: number) {
    const project = await prisma.project.findUnique({
      where: { id }
    });

    if (!project) {
      throw new Error("Projet non trouvé");
    }

    return await prisma.project.delete({
      where: { id }
    });
  }
} 