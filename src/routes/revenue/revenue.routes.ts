import { Router } from 'express';
import { marketRateLimiter } from '../../middleware/apiRateLimiter';
import { AfBuybacksService, AfBuybacksUnavailableError } from '../../services/revenue/afBuybacks.service';
import { RevenueService } from '../../services/revenue/revenue.service';
import { RevenueError, RevenueWindow } from '../../types/revenue.types';
import { logDeduplicator } from '../../utils/logDeduplicator';

const router = Router();
const revenueService = RevenueService.getInstance();
const afBuybacksService = AfBuybacksService.getInstance();

const VALID_WINDOWS: RevenueWindow[] = ['7d', '30d', '90d', '1y', 'all'];

router.get('/history', async (req, res) => {
  const raw = (req.query.window as string | undefined) ?? '30d';
  const window = VALID_WINDOWS.includes(raw as RevenueWindow) ? (raw as RevenueWindow) : null;

  if (!window) {
    return res.status(400).json({
      success: false,
      error: { message: `Invalid window. Must be one of: ${VALID_WINDOWS.join(', ')}`, code: 'INVALID_WINDOW' },
    });
  }

  try {
    const breakdown = await revenueService.getBreakdown(window);
    return res.json({ success: true, data: breakdown });
  } catch (error: unknown) {
    logDeduplicator.error('Error fetching revenue breakdown:', { error: error instanceof Error ? error.message : String(error) });

    if (error instanceof RevenueError) {
      return res.status(error.statusCode).json({
        success: false,
        error: { message: error.message, code: error.code },
      });
    }
    return res.status(500).json({
      success: false,
      error: { message: error instanceof Error ? error.message : 'Internal server error', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
});

/**
 * GET /market/revenue/af-buybacks
 * The Assistance Fund's HYPE buybacks: the last 13 completed UTC days read
 * whole (a day Hyperliquid no longer holds whole is left out), the running
 * day so far and its latest buys. The backend reads the fund's fills for
 * every visitor: the running day at most once a minute, a completed day once.
 */
router.get('/af-buybacks', marketRateLimiter, async (_req, res) => {
  try {
    const data = await afBuybacksService.getBuybacks();
    return res.json({ success: true, data });
  } catch (error: unknown) {
    if (error instanceof AfBuybacksUnavailableError) {
      return res.status(503).json({
        success: false,
        error: { message: 'Assistance Fund buybacks temporarily unavailable', code: 'AF_BUYBACKS_UNAVAILABLE' },
      });
    }
    logDeduplicator.error('Error fetching Assistance Fund buybacks:', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({
      success: false,
      error: { message: 'Internal server error', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
});

export default router;
