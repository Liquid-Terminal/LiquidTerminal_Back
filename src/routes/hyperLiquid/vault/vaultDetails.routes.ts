import { Router, Request, Response, RequestHandler } from 'express';
import { VaultDetailsService } from '../../../services/apiHyperliquid/vault/vaultDetails.service';
import { marketRateLimiter } from '../../../middleware/rateLimiter';

const router = Router();
const vaultDetailsService = new VaultDetailsService();

router.use(marketRateLimiter);

// Route pour récupérer les détails d'un vault spécifique
router.get('/:vaultAddress', (async (req: Request, res: Response) => {
  try {
    const { vaultAddress } = req.params;
    const { user } = req.query;

    // Vérifier que l'adresse du vault est au format hexadécimal
    if (!vaultAddress || !/^0x[a-fA-F0-9]{40}$/.test(vaultAddress)) {
      return res.status(400).json({
        error: 'Invalid vault address format',
        message: 'Vault address must be a 42-character hexadecimal string starting with 0x'
      });
    }

    // Vérifier que l'adresse de l'utilisateur est au format hexadécimal si elle est fournie
    if (user && typeof user === 'string' && !/^0x[a-fA-F0-9]{40}$/.test(user)) {
      return res.status(400).json({
        error: 'Invalid user address format',
        message: 'User address must be a 42-character hexadecimal string starting with 0x'
      });
    }

    const vaultDetails = await vaultDetailsService.getVaultDetails(
      vaultAddress,
      typeof user === 'string' ? user : undefined
    );

    res.json(vaultDetails);
  } catch (error) {
    console.error('Error fetching vault details:', error);
    res.status(500).json({
      error: 'Failed to fetch vault details',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

export default router; 