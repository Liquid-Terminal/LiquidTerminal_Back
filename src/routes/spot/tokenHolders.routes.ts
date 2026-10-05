import express, { Request, Response, RequestHandler } from 'express';
import { marketRateLimiter } from '../../middleware/apiRateLimiter';
import {
  HoldersUnavailableError,
  TokenHoldersService,
  UnknownTokenError,
} from '../../services/spot/tokenHolders.service';
import { logDeduplicator } from '../../utils/logDeduplicator';

const router = express.Router();
const holdersService = TokenHoldersService.getInstance();

router.use(marketRateLimiter);

/** Hyperliquid spot token names are short alphanumerics ("HYPE", "UBTC"). */
const TOKEN_RE = /^[A-Za-z0-9]{1,20}$/;
const MAX_LIMIT = 100;

const intParam = (value: unknown, fallback: number): number => {
  const n = typeof value === 'string' ? Number(value) : NaN;
  return Number.isInteger(n) ? n : fallback;
};

/**
 * GET /market/holders/:token
 * One page of a spot token's holders (spot + staked balances summed), largest
 * first, with the holder count, the summed balance and the whale → retail
 * cohorts of every holder.
 *
 * Query params:
 * - page: number (default 1)
 * - limit: number (default 10, max 100)
 * Only the largest 10,000 holders can be paged through.
 */
router.get('/:token',
  (async (req: Request, res: Response) => {
    const token = String(req.params.token);
    const page = intParam(req.query.page, 1);
    const limit = intParam(req.query.limit, 10);

    if (!TOKEN_RE.test(token) || page < 1 || limit < 1 || limit > MAX_LIMIT) {
      return res.status(400).json({
        success: false,
        error: 'Invalid token, page or limit',
        code: 'INVALID_PARAMS',
      });
    }

    try {
      const data = await holdersService.getHoldersPage(token, page, limit);
      res.json({ success: true, data });
    } catch (error) {
      if (error instanceof UnknownTokenError) {
        return res.status(404).json({ success: false, error: error.message, code: 'UNKNOWN_TOKEN' });
      }
      logDeduplicator.error('Error fetching token holders:', {
        token,
        error: error instanceof Error ? error.message : String(error),
      });
      const unavailable = error instanceof HoldersUnavailableError;
      res.status(unavailable ? 503 : 500).json({
        success: false,
        error: unavailable ? 'Holders temporarily unavailable' : 'Internal server error',
        code: unavailable ? 'HOLDERS_UNAVAILABLE' : 'HOLDERS_ERROR',
      });
    }
  }) as RequestHandler
);

export default router;
