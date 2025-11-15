import express, { Request, Response } from 'express';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { StorageService } from '../../core/storage.service';
import { logDeduplicator } from '../../utils/logDeduplicator';

const router = express.Router();
const prisma = new PrismaClient();
const storageService = StorageService.getInstance();

// Middleware de sécurité
const validateMigrationToken = (req: Request, res: Response, next: express.NextFunction) => {
  const token = req.headers['x-migration-token'] as string;
  
  if (!token || token !== process.env.MIGRATION_SECRET_TOKEN) {
    return res.status(403).json({
      success: false,
      error: 'Invalid migration token',
      code: 'FORBIDDEN'
    });
  }
  
  next();
};

// Fonction pour migrer une URL
async function migrateImageUrl(oldUrl: string, folder: string): Promise<string> {
  // Si l'URL ne pointe pas vers Railway, on skip
  if (!oldUrl.includes('/uploads/')) {
    return oldUrl;
  }

  try {
    // Télécharger l'image depuis Railway
    const response = await axios.get(oldUrl, {
      responseType: 'arraybuffer',
      timeout: 30000
    });
    
    const buffer = Buffer.from(response.data);
    const contentType = response.headers['content-type'] || 'image/jpeg';
    const filename = oldUrl.split('/').pop() || 'image.jpg';

    // Upload vers R2
    const { url } = await storageService.uploadFile(
      buffer,
      folder,
      filename,
      contentType
    );

    logDeduplicator.info('Image migrated to R2', { oldUrl, newUrl: url });
    return url;
  } catch (error: any) {
    logDeduplicator.error('Failed to migrate image', { oldUrl, error: error.message });
    return oldUrl; // En cas d'échec, on garde l'ancienne URL
  }
}

// Endpoint de migration
router.post('/migrate-images-to-r2', validateMigrationToken, async (req: Request, res: Response) => {
  try {
    logDeduplicator.info('🚀 Starting image migration to R2...');

    const stats = {
      projects: { total: 0, migrated: 0, failed: 0 },
      publicGoods: { total: 0, migrated: 0, failed: 0 }
    };

    // ========== MIGRATION PROJECTS ==========
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { logo: { contains: '/uploads/' } },
          { banner: { contains: '/uploads/' } }
        ]
      }
    });

    stats.projects.total = projects.length;
    logDeduplicator.info(`Found ${projects.length} projects to migrate`);

    for (const project of projects) {
      try {
        const updates: any = {};

        // Migrer le logo
        if (project.logo && project.logo.includes('/uploads/')) {
          updates.logo = await migrateImageUrl(project.logo, 'projects/logos');
        }

        // Migrer le banner
        if (project.banner && project.banner.includes('/uploads/')) {
          updates.banner = await migrateImageUrl(project.banner, 'projects/banners');
        }

        // Update en DB
        if (Object.keys(updates).length > 0) {
          await prisma.project.update({
            where: { id: project.id },
            data: updates
          });
          stats.projects.migrated++;
          logDeduplicator.info(`✅ Project ${project.id} migrated`);
        }
      } catch (error: any) {
        stats.projects.failed++;
        logDeduplicator.error(`❌ Failed to migrate project ${project.id}`, { error: error.message });
      }
    }

    // ========== MIGRATION PUBLIC GOODS ==========
    const publicGoods = await prisma.publicGood.findMany({
      where: {
        OR: [
          { logo: { contains: '/uploads/' } },
          { banner: { contains: '/uploads/' } },
          { screenshots: { isEmpty: false } }
        ]
      }
    });

    stats.publicGoods.total = publicGoods.length;
    logDeduplicator.info(`Found ${publicGoods.length} public goods to migrate`);

    for (const pg of publicGoods) {
      try {
        const updates: any = {};

        // Migrer le logo
        if (pg.logo && pg.logo.includes('/uploads/')) {
          updates.logo = await migrateImageUrl(pg.logo, 'publicgoods/logos');
        }

        // Migrer le banner
        if (pg.banner && pg.banner.includes('/uploads/')) {
          updates.banner = await migrateImageUrl(pg.banner, 'publicgoods/banners');
        }

        // Migrer les screenshots
        if (pg.screenshots && pg.screenshots.length > 0) {
          const migratedScreenshots: string[] = [];
          for (const screenshot of pg.screenshots) {
            if (screenshot.includes('/uploads/')) {
              const newUrl = await migrateImageUrl(screenshot, 'publicgoods/screenshots');
              migratedScreenshots.push(newUrl);
            } else {
              migratedScreenshots.push(screenshot);
            }
          }
          updates.screenshots = migratedScreenshots;
        }

        // Update en DB
        if (Object.keys(updates).length > 0) {
          await prisma.publicGood.update({
            where: { id: pg.id },
            data: updates
          });
          stats.publicGoods.migrated++;
          logDeduplicator.info(`✅ PublicGood ${pg.id} migrated`);
        }
      } catch (error: any) {
        stats.publicGoods.failed++;
        logDeduplicator.error(`❌ Failed to migrate public good ${pg.id}`, { error: error.message });
      }
    }

    logDeduplicator.info('✅ Migration completed', { stats });

    res.json({
      success: true,
      data: {
        message: 'Migration completed',
        stats
      }
    });

  } catch (error: any) {
    logDeduplicator.error('Migration failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Migration failed',
      code: 'INTERNAL_SERVER_ERROR',
      details: error.message
    });
  }
});

export default router;

