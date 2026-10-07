import express, { Request, Response, RequestHandler } from 'express';
import { z, ZodError } from 'zod';
import { prisma } from '../../core/prisma.service';
import { marketRateLimiter } from '../../middleware/apiRateLimiter';
import { validatePrivyToken } from '../../middleware/authMiddleware';
import { TelegramError } from '../../errors/telegram.errors';
import { logDeduplicator } from '../../utils/logDeduplicator';
import { AlertRuleService } from '../../services/alerts/alert-rule.service';
import { ALERT_RULE_TYPES } from '../../services/alerts/alert-rule.types';

/**
 * Generic alert rules (price, funding, OI, listings, leverage, liquidation
 * cascades), managed from the site. Delivered to the user's linked Telegram.
 */
const router = express.Router();
const service = AlertRuleService.getInstance();

router.use(marketRateLimiter);
router.use(validatePrivyToken);

const createSchema = z
  .object({
    type: z.enum(ALERT_RULE_TYPES as [string, ...string[]]),
    params: z.record(z.string(), z.unknown()).default({}),
    name: z.string().max(100).optional(),
  })
  .strict();
const patchSchema = z
  .object({
    isActive: z.boolean().optional(),
    name: z.string().max(100).optional(),
    params: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

async function userIdOf(req: Request): Promise<number | null> {
  const privyUserId = req.user?.sub;
  if (!privyUserId) return null;
  const user = await prisma.user.findUnique({ where: { privyUserId }, select: { id: true } });
  return user?.id ?? null;
}

function fail(res: Response, error: unknown, context: string) {
  if (error instanceof ZodError) {
    return res.status(400).json({ success: false, error: error.issues[0]?.message ?? 'Invalid alert settings', code: 'VALIDATION_ERROR' });
  }
  if (error instanceof TelegramError) {
    return res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
  }
  logDeduplicator.error(context, { error: error instanceof Error ? error.message : String(error) });
  return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR' });
}

const unauth = (res: Response) =>
  res.status(401).json({ success: false, error: 'User not authenticated', code: 'UNAUTHENTICATED' });

router.get('/rules', (async (req: Request, res: Response) => {
  try {
    const userId = await userIdOf(req);
    if (!userId) return unauth(res);
    res.json({ success: true, data: await service.list(userId) });
  } catch (error) {
    fail(res, error, 'Error listing alert rules');
  }
}) as RequestHandler);

router.post('/rules', (async (req: Request, res: Response) => {
  try {
    const body = createSchema.parse(req.body ?? {});
    const userId = await userIdOf(req);
    if (!userId) return unauth(res);
    res.status(201).json({ success: true, data: await service.create(userId, body.type as never, body.params, body.name) });
  } catch (error) {
    fail(res, error, 'Error creating alert rule');
  }
}) as RequestHandler);

router.patch('/rules/:id', (async (req: Request, res: Response) => {
  try {
    const body = patchSchema.parse(req.body ?? {});
    const userId = await userIdOf(req);
    if (!userId) return unauth(res);
    res.json({ success: true, data: await service.update(userId, String(req.params.id), body) });
  } catch (error) {
    fail(res, error, 'Error updating alert rule');
  }
}) as RequestHandler);

router.delete('/rules/:id', (async (req: Request, res: Response) => {
  try {
    const userId = await userIdOf(req);
    if (!userId) return unauth(res);
    await service.remove(userId, String(req.params.id));
    res.json({ success: true });
  } catch (error) {
    fail(res, error, 'Error deleting alert rule');
  }
}) as RequestHandler);

export default router;
