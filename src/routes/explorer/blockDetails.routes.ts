import { Router, Request, Response, RequestHandler } from 'express';
import { ExplorerService } from '../../services/explorer/explorer.service';
import { marketRateLimiter } from '../../middleware/rateLimiter';

const router = Router();
const explorerService = new ExplorerService();

router.use(marketRateLimiter);

// Route pour récupérer les détails d'un bloc spécifique
router.get('/:height', (async (req: Request, res: Response) => {
  try {
    const heightParam = req.params.height;
    
    // Vérifier que la hauteur est un nombre valide
    // Utiliser un regex pour valider que c'est un nombre entier positif
    if (!heightParam || !/^\d+$/.test(heightParam)) {
      return res.status(400).json({
        error: 'Invalid block height',
        message: 'Block height must be a positive integer'
      });
    }
    
    // Convertir en nombre (pour les grands nombres, on utilise BigInt en interne mais on passe un number à l'API)
    const height = parseInt(heightParam, 10);
    
    const blockDetails = await explorerService.getBlockDetails(height);
    res.json(blockDetails);
  } catch (error) {
    console.error('Error fetching block details:', error);
    res.status(500).json({
      error: 'Failed to fetch block details',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

export default router; 