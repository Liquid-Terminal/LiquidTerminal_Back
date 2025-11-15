import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logDeduplicator } from '../../utils/logDeduplicator';

const router = express.Router();
const prisma = new PrismaClient();

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

// Endpoint pour mettre à jour les URLs
router.post('/update-urls-to-r2', validateMigrationToken, async (req: Request, res: Response) => {
  try {
    logDeduplicator.info('🚀 Starting URL replacement in database...');

    const OLD_BASE = 'https://liquidterminal.up.railway.app';
    const NEW_BASE = 'https://pub-097cebbc75d04a3fbd5d0e416820c1a5.r2.dev';

    const stats = {
      projects: { updated: 0 },
      publicGoods: { updated: 0 }
    };

    // ========== UPDATE PROJECTS ==========
    
    // Update logos
    const projectLogosUpdate = await prisma.$executeRaw`
      UPDATE "Project"
      SET "logo" = REPLACE("logo", ${OLD_BASE + '/uploads/logos'}, ${NEW_BASE + '/projects/logos'})
      WHERE "logo" LIKE ${OLD_BASE + '/uploads/logos%'}
    `;
    
    // Update banners
    const projectBannersUpdate = await prisma.$executeRaw`
      UPDATE "Project"
      SET "banner" = REPLACE("banner", ${OLD_BASE + '/uploads/logos'}, ${NEW_BASE + '/projects/banners'})
      WHERE "banner" LIKE ${OLD_BASE + '/uploads/logos%'}
    `;

    stats.projects.updated = projectLogosUpdate + projectBannersUpdate;

    logDeduplicator.info(`✅ Updated ${stats.projects.updated} project URLs`);

    // ========== UPDATE PUBLIC GOODS ==========
    
    // Update logos
    const pgLogosUpdate = await prisma.$executeRaw`
      UPDATE "PublicGood"
      SET "logo" = REPLACE("logo", ${OLD_BASE + '/uploads/publicgoods/logos'}, ${NEW_BASE + '/publicgoods/logos'})
      WHERE "logo" LIKE ${OLD_BASE + '/uploads/publicgoods/logos%'}
    `;
    
    // Update banners
    const pgBannersUpdate = await prisma.$executeRaw`
      UPDATE "PublicGood"
      SET "banner" = REPLACE("banner", ${OLD_BASE + '/uploads/publicgoods/banners'}, ${NEW_BASE + '/publicgoods/banners'})
      WHERE "banner" LIKE ${OLD_BASE + '/uploads/publicgoods/banners%'}
    `;

    stats.publicGoods.updated = pgLogosUpdate + pgBannersUpdate;

    logDeduplicator.info(`✅ Updated ${stats.publicGoods.updated} public good URLs`);

    // Note: Screenshots pour PublicGoods sont plus complexes (array JSON)
    // On va les update manuellement
    const publicGoodsWithScreenshots = await prisma.publicGood.findMany({
      where: {
        screenshots: {
          isEmpty: false
        }
      }
    });

    let screenshotsUpdated = 0;
    for (const pg of publicGoodsWithScreenshots) {
      const updatedScreenshots = pg.screenshots.map((url: string) => 
        url.replace(
          OLD_BASE + '/uploads/publicgoods/screenshots',
          NEW_BASE + '/publicgoods/screenshots'
        )
      );
      
      await prisma.publicGood.update({
        where: { id: pg.id },
        data: { screenshots: updatedScreenshots }
      });
      screenshotsUpdated++;
    }

    logDeduplicator.info(`✅ Updated ${screenshotsUpdated} public goods with screenshots`);

    logDeduplicator.info('✅ URL replacement completed', { stats });

    res.json({
      success: true,
      data: {
        message: 'URLs updated successfully',
        stats: {
          ...stats,
          screenshotsUpdated
        }
      }
    });

  } catch (error: any) {
    logDeduplicator.error('URL replacement failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'URL replacement failed',
      code: 'INTERNAL_SERVER_ERROR',
      details: error.message
    });
  }
});

export default router;

