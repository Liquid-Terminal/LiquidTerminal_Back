import express, { Request, Response, RequestHandler } from 'express';
import { marketRateLimiter } from '../../middleware/apiRateLimiter';
import { TwapService, TwapUnavailableError } from '../../services/twap/twap.service';
import { logDeduplicator } from '../../utils/logDeduplicator';

const router = express.Router();
const twapService = TwapService.getInstance();

router.use(marketRateLimiter);

/**
 * GET /market/twap
 * TWAP orders of the last ~24 h (Hypurrscan), each with its market resolved:
 * tokenSymbol, tokenPrice, marketIndex, marketType ('spot' | 'perp' | 'hip3').
 *
 * Query params:
 * - status: 'active' (not ended, no error) | 'all' (default 'all')
 */
router.get('/',
  (async (req: Request, res: Response) => {
    const status = req.query.status ?? 'all';
    if (status !== 'active' && status !== 'all') {
      return res.status(400).json({ success: false, error: 'Invalid status', code: 'INVALID_PARAMS' });
    }

    try {
      const { orders, lastUpdate } = await twapService.getOrders(status);
      res.json({ success: true, data: orders, lastUpdate });
    } catch (error) {
      logDeduplicator.error('Error fetching TWAP orders:', {
        error: error instanceof Error ? error.message : String(error),
      });
      const unavailable = error instanceof TwapUnavailableError;
      res.status(unavailable ? 503 : 500).json({
        success: false,
        error: unavailable ? 'TWAP orders temporarily unavailable' : 'Internal server error',
        code: unavailable ? 'TWAP_UNAVAILABLE' : 'TWAP_ERROR',
      });
    }
  }) as RequestHandler
);

export default router;
