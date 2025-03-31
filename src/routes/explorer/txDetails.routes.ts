import { Router, Request, Response, RequestHandler } from 'express';
import { ExplorerService } from '../../services/explorer/explorer.service';
import { marketRateLimiter } from '../../middleware/rateLimiter';

const router = Router();
const explorerService = new ExplorerService();

router.use(marketRateLimiter);

// Route pour récupérer les détails d'une transaction spécifique
router.get('/:hash', (async (req: Request, res: Response) => {
  try {
    const { hash } = req.params;
    
    // Vérifier que le hash est au format valide (format hexadécimal de 64 caractères après le préfixe 0x)
    if (!hash || !/^0x[a-fA-F0-9]{64}$/.test(hash)) {
      return res.status(400).json({
        error: 'Invalid transaction hash format',
        message: 'Transaction hash must be a 66-character hexadecimal string (0x + 64 characters)'
      });
    }
    
    const txDetails = await explorerService.getTxDetails(hash);
    res.json(txDetails);
  } catch (error) {
    console.error('Error fetching transaction details:', error);
    res.status(500).json({
      error: 'Failed to fetch transaction details',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

export default router; 