import prisma from '../lib/prisma';
import { CategoryCreateInput, CategoryUpdateInput } from '../types/category.types';

export class CategoryService {
  /**
   * Récupère toutes les catégories
   */
  async getAllCategories() {
    return prisma.category.findMany({
      orderBy: {
        name: 'asc'
      }
    });
  }

  /**
   * Récupère une catégorie par son ID
   */
  async getCategoryById(id: number) {
    return prisma.category.findUnique({
      where: { id }
    });
  }

  /**
   * Récupère une catégorie avec ses projets
   */
  async getCategoryWithProjects(id: number) {
    return prisma.category.findUnique({
      where: { id },
      include: {
        projects: {
          select: {
            id: true,
            title: true,
            desc: true,
            logo: true
          }
        }
      }
    });
  }

  /**
   * Crée une nouvelle catégorie
   */
  async createCategory(data: CategoryCreateInput) {
    return prisma.category.create({
      data
    });
  }

  /**
   * Met à jour une catégorie existante
   */
  async updateCategory(id: number, data: CategoryUpdateInput) {
    return prisma.category.update({
      where: { id },
      data
    });
  }

  /**
   * Supprime une catégorie
   */
  async deleteCategory(id: number) {
    return prisma.category.delete({
      where: { id }
    });
  }

  /**
   * Récupère tous les projets d'une catégorie
   */
  async getProjectsByCategory(categoryId: number) {
    return prisma.project.findMany({
      where: {
        categoryId
      }
    });
  }
} 