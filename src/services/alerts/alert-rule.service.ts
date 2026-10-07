import { Prisma } from '@prisma/client';
import { prisma } from '../../core/prisma.service';
import { prismaTelegram } from '../../core/prisma.telegram.service';
import { TelegramError } from '../../errors/telegram.errors';
import {
  AlertRuleType,
  MAX_ALERT_RULES_PER_USER,
  defaultRuleName,
  parseRuleParams,
} from './alert-rule.types';

export class AlertRuleNotFoundError extends TelegramError {
  constructor() {
    super('Alert not found', 404, 'ALERT_RULE_NOT_FOUND');
  }
}
export class AlertRuleLimitError extends TelegramError {
  constructor() {
    super(`You can have at most ${MAX_ALERT_RULES_PER_USER} alerts`, 409, 'ALERT_RULE_LIMIT');
  }
}
export class AlertRuleTelegramRequiredError extends TelegramError {
  constructor() {
    super('Link your Telegram account first to receive alerts', 409, 'TELEGRAM_NOT_LINKED');
  }
}

export interface AlertRuleView {
  id: string;
  type: string;
  name: string;
  params: Record<string, unknown>;
  isActive: boolean;
  createdAt: Date;
}

const toView = (r: { id: string; type: string; name: string; params: Prisma.JsonValue; isActive: boolean; createdAt: Date }): AlertRuleView => ({
  id: r.id,
  type: r.type,
  name: r.name,
  params: (r.params ?? {}) as Record<string, unknown>,
  isActive: r.isActive,
  createdAt: r.createdAt,
});

/** CRUD for the generic alert rules, scoped to one Liquid Terminal user. */
export class AlertRuleService {
  private static instance: AlertRuleService;

  public static getInstance(): AlertRuleService {
    if (!AlertRuleService.instance) AlertRuleService.instance = new AlertRuleService();
    return AlertRuleService.instance;
  }

  private async linkedTelegram(userId: number) {
    return prismaTelegram.telegramUser.findFirst({
      where: { linkedUserId: userId },
      select: { telegramId: true, username: true, firstName: true },
    });
  }

  async list(userId: number) {
    const [tg, rules] = await Promise.all([
      this.linkedTelegram(userId),
      prisma.alertRule.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    ]);
    return {
      telegram: { linked: Boolean(tg), username: tg ? tg.username || tg.firstName || null : null },
      limit: MAX_ALERT_RULES_PER_USER,
      rules: rules.map(toView),
    };
  }

  async create(userId: number, type: AlertRuleType, rawParams: unknown, name?: string): Promise<AlertRuleView> {
    const params = parseRuleParams(type, rawParams);
    const tg = await this.linkedTelegram(userId);
    if (!tg) throw new AlertRuleTelegramRequiredError();
    const count = await prisma.alertRule.count({ where: { userId } });
    if (count >= MAX_ALERT_RULES_PER_USER) throw new AlertRuleLimitError();
    const rule = await prisma.alertRule.create({
      data: {
        userId,
        telegramId: tg.telegramId,
        type,
        name: (name?.trim() || defaultRuleName(type, params)).slice(0, 100),
        params: params as Prisma.InputJsonValue,
      },
    });
    return toView(rule);
  }

  async update(
    userId: number,
    id: string,
    patch: { isActive?: boolean; name?: string; params?: unknown }
  ): Promise<AlertRuleView> {
    const existing = await prisma.alertRule.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new AlertRuleNotFoundError();
    const data: Prisma.AlertRuleUpdateInput = {};
    if (patch.isActive !== undefined) data.isActive = patch.isActive;
    if (patch.name !== undefined) data.name = patch.name.trim().slice(0, 100) || existing.name;
    if (patch.params !== undefined) {
      data.params = parseRuleParams(existing.type as AlertRuleType, patch.params) as Prisma.InputJsonValue;
    }
    // Re-point the rule at the currently linked Telegram (the link may have changed).
    if (patch.isActive) {
      const tg = await this.linkedTelegram(userId);
      if (!tg) throw new AlertRuleTelegramRequiredError();
      data.telegramId = tg.telegramId;
    }
    return toView(await prisma.alertRule.update({ where: { id }, data }));
  }

  async remove(userId: number, id: string): Promise<void> {
    const { count } = await prisma.alertRule.deleteMany({ where: { id, userId } });
    if (!count) throw new AlertRuleNotFoundError();
  }
}
