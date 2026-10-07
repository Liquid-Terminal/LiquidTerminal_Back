import crypto from 'crypto';
import { prisma } from '../../core/prisma.service';
import { prismaTelegram } from '../../core/prisma.telegram.service';
import { redisService } from '../../core/redis.service';
import { logDeduplicator } from '../../utils/logDeduplicator';
import { WalletService } from '../wallet/wallet.service';
import { WalletListService } from '../walletlist/walletlist.service';
import { WalletListItemService } from '../walletlist/walletlist-item.service';
import {
  LinkedAccountResponse,
  LinkedWalletResponse,
  LinkedWalletListResponse,
} from '../../types/telegram.types';
import {
  TelegramError,
  TelegramUserNotFoundError,
  TelegramAccountNotLinkedError,
  TelegramAlreadyLinkedError,
} from '../../errors/telegram.errors';

/**
 * TelegramService (Singleton)
 * 
 * Bridge between the Telegram bot and existing services.
 * Resolves telegramId -> userId, then delegates to WalletService / WalletListService.
 */
export class TelegramService {
  private static instance: TelegramService;

  private walletService = new WalletService();
  private walletListService = new WalletListService();
  private walletListItemService = new WalletListItemService();

  private constructor() {}

  public static getInstance(): TelegramService {
    if (!TelegramService.instance) {
      TelegramService.instance = new TelegramService();
    }
    return TelegramService.instance;
  }

  // ==================== PRIVATE HELPERS ====================

  /**
   * Resolve telegramId -> userId
   * @throws TelegramAccountNotLinkedError if no linked account
   */
  private async resolveUserId(telegramId: bigint): Promise<number> {
    const telegramUser = await prismaTelegram.telegramUser.findUnique({
      where: { telegramId },
      select: { linkedUserId: true },
    });

    if (!telegramUser) {
      throw new TelegramUserNotFoundError();
    }

    if (!telegramUser.linkedUserId) {
      throw new TelegramAccountNotLinkedError();
    }

    return telegramUser.linkedUserId;
  }

  // ==================== BOT ENDPOINTS ====================

  /**
   * Get linked account info for a Telegram user.
   * Called by bot on /start to check if account is linked.
   */
  public async getLinkedAccount(telegramId: bigint): Promise<LinkedAccountResponse> {
    try {
      const telegramUser = await prismaTelegram.telegramUser.findUnique({
        where: { telegramId },
      });

      if (!telegramUser || !telegramUser.linkedUserId) {
        return {
          linked: false,
          walletCount: 0,
        };
      }

      const user = await prisma.user.findUnique({
        where: { id: telegramUser.linkedUserId },
        include: {
          _count: {
            select: { UserWallets: true },
          },
        },
      });

      if (!user) {
        return {
          linked: false,
          walletCount: 0,
        };
      }

      return {
        linked: true,
        userId: user.id,
        email: user.email || undefined,
        name: user.name || undefined,
        walletCount: user._count.UserWallets,
      };
    } catch (error) {
      logDeduplicator.error('TelegramService: Error getting linked account', {
        telegramId: telegramId.toString(),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get linked wallets for a Telegram user.
   * Delegates to WalletService.getWalletsByUser().
   */
  public async getLinkedWallets(
    telegramId: bigint,
    page: number = 1,
    limit: number = 50
  ): Promise<{ data: LinkedWalletResponse[]; pagination: any }> {
    try {
      const userId = await this.resolveUserId(telegramId);
      const result = await this.walletService.getWalletsByUser(userId, page, limit);

      return {
        data: result.data.map((uw) => ({
          id: uw.id,
          address: uw.wallet.address,
          name: uw.name,
          addedAt: uw.addedAt,
        })),
        pagination: result.pagination,
      };
    } catch (error) {
      if (error instanceof TelegramUserNotFoundError || error instanceof TelegramAccountNotLinkedError) {
        throw error;
      }
      logDeduplicator.error('TelegramService: Error getting linked wallets', {
        telegramId: telegramId.toString(),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get linked wallet lists for a Telegram user.
   * Delegates to WalletListService.getByUser().
   */
  public async getLinkedWalletLists(telegramId: bigint): Promise<LinkedWalletListResponse[]> {
    try {
      const userId = await this.resolveUserId(telegramId);
      const walletLists = await this.walletListService.getByUser(userId);

      return walletLists.map((wl) => ({
        id: wl.id,
        name: wl.name,
        description: wl.description,
        isPublic: wl.isPublic,
        itemsCount: wl.itemsCount,
        createdAt: wl.createdAt,
      }));
    } catch (error) {
      if (error instanceof TelegramUserNotFoundError || error instanceof TelegramAccountNotLinkedError) {
        throw error;
      }
      logDeduplicator.error('TelegramService: Error getting linked wallet lists', {
        telegramId: telegramId.toString(),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get wallet list items for a Telegram user.
   * Delegates to WalletListItemService.getByWalletListWithPermission().
   */
  public async getWalletListItems(telegramId: bigint, listId: number) {
    try {
      const userId = await this.resolveUserId(telegramId);
      return await this.walletListItemService.getByWalletListWithPermission(listId, userId);
    } catch (error) {
      if (error instanceof TelegramUserNotFoundError || error instanceof TelegramAccountNotLinkedError) {
        throw error;
      }
      logDeduplicator.error('TelegramService: Error getting wallet list items', {
        telegramId: telegramId.toString(),
        listId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // ==================== DEEP LINK CODE SYSTEM ====================

  private static readonly LINK_CODE_PREFIX = 'telegram:link:';
  private static readonly LINK_CODE_TTL = 300; // 5 minutes
  /** Bytes of entropy per code. 16 bytes = 128-bit, unguessable within the TTL.
   * (Was `randomBytes(8).slice(0,8)` = only 32 bits after truncation.) */
  private static readonly LINK_CODE_BYTES = 16;

  /** Shape of a link code as issued by generateLinkCode (32 uppercase hex chars). */
  public static readonly LINK_CODE_PATTERN = /^[A-F0-9]{32}$/;

  /** Short, non-reversible tag for correlating a link code in logs without
   * writing the live credential itself. */
  private static hashCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex').slice(0, 8);
  }

  /**
   * Generate a temporary link code for a user.
   * Called by frontend: POST /auth/telegram/generate-link
   * Returns a code the user sends to the bot via deep link.
   */
  public async generateLinkCode(userId: number): Promise<{ code: string; deepLink: string }> {
    try {
      // Check if user already has a linked telegram
      const existingLink = await prismaTelegram.telegramUser.findFirst({
        where: { linkedUserId: userId },
      });

      if (existingLink) {
        throw new TelegramAlreadyLinkedError('Your account is already linked to a Telegram account');
      }

      // Generate a random code (full entropy, no truncation)
      const code = crypto.randomBytes(TelegramService.LINK_CODE_BYTES).toString('hex').toUpperCase();

      // Store in Redis: code -> userId (TTL 5 min)
      const redisKey = `${TelegramService.LINK_CODE_PREFIX}${code}`;
      await redisService.set(redisKey, JSON.stringify({ userId }), TelegramService.LINK_CODE_TTL);

      const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'LiquidTerminalBot';
      const deepLink = `https://t.me/${botUsername}?start=LINK_${code}`;

      // Never log the live code — anyone reading logs during the TTL could bind
      // their own Telegram account to this user. Log a hash for correlation.
      logDeduplicator.info('TelegramService: Link code generated', {
        userId,
        codeHash: TelegramService.hashCode(code),
      });

      return { code, deepLink };
    } catch (error) {
      if (error instanceof TelegramError) {
        throw error;
      }
      logDeduplicator.error('TelegramService: Error generating link code', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Verify a link code and link the Telegram account.
   * Called by bot: POST /telegram/verify-link
   * The bot extracts the code from /start LINK_XXXXX and sends it here with the telegramId.
   */
  public async verifyLinkCode(
    code: string,
    telegramId: bigint,
    username?: string,
    firstName?: string
  ): Promise<{ userId: number }> {
    try {
      // Consume the code atomically (GETDEL): a code can be redeemed once,
      // even if two requests race with it.
      const redisKey = `${TelegramService.LINK_CODE_PREFIX}${code}`;
      const stored = await redisService.getDel(redisKey);

      if (!stored) {
        throw new TelegramError('Invalid or expired link code', 400, 'INVALID_LINK_CODE');
      }

      const { userId } = JSON.parse(stored) as { userId: number };

      // Check if this telegramId is already linked to another user
      const existing = await prismaTelegram.telegramUser.findUnique({
        where: { telegramId },
      });

      if (existing && existing.linkedUserId && existing.linkedUserId !== userId) {
        throw new TelegramAlreadyLinkedError();
      }

      // Link the account
      if (existing) {
        await prismaTelegram.telegramUser.update({
          where: { telegramId },
          data: {
            linkedUserId: userId,
            username: username || existing.username,
            firstName: firstName || existing.firstName,
          },
        });
      } else {
        await prismaTelegram.telegramUser.create({
          data: {
            telegramId,
            linkedUserId: userId,
            username,
            firstName,
          },
        });
      }

      logDeduplicator.info('TelegramService: Account linked via deep link', {
        telegramId: telegramId.toString(),
        userId,
        codeHash: TelegramService.hashCode(code),
      });

      return { userId };
    } catch (error) {
      if (error instanceof TelegramError) {
        throw error;
      }
      logDeduplicator.error('TelegramService: Error verifying link code', {
        codeHash: TelegramService.hashCode(code),
        telegramId: telegramId.toString(),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Check if a link code has been consumed (account linked).
   * Called by frontend to poll: GET /auth/telegram/link-status/:code
   */
  public async getLinkStatus(code: string, userId: number): Promise<{ linked: boolean; expired?: boolean; telegramUsername?: string }> {
    try {
      // Check if user now has a linked telegram
      const telegramUser = await prismaTelegram.telegramUser.findFirst({
        where: { linkedUserId: userId },
      });

      if (telegramUser) {
        return {
          linked: true,
          telegramUsername: telegramUser.username || undefined,
        };
      }

      // Not linked yet: tell the caller whether the code is still pending, so
      // the UI can stop polling and offer a fresh link once it has expired.
      const redisKey = `${TelegramService.LINK_CODE_PREFIX}${code}`;
      const stored = await redisService.get(redisKey);

      return { linked: false, expired: stored === null };
    } catch (error) {
      logDeduplicator.error('TelegramService: Error checking link status', {
        codeHash: TelegramService.hashCode(code),
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Telegram handle linked to a LiquidTerminal user, if any. Lets the session
   * endpoints report the link state, so the UI stays correct after a reload.
   * Fail-soft: null when the Telegram DB is unreachable.
   */
  public async getLinkedTelegram(userId: number): Promise<{ linked: boolean; username: string | null }> {
    try {
      const telegramUser = await prismaTelegram.telegramUser.findFirst({
        where: { linkedUserId: userId },
        select: { username: true, firstName: true },
      });
      if (!telegramUser) return { linked: false, username: null };
      return { linked: true, username: telegramUser.username || telegramUser.firstName || null };
    } catch (error) {
      logDeduplicator.warn('TelegramService: Could not read link state', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { linked: false, username: null };
    }
  }

  /**
   * Unlink a Telegram account from a LiquidTerminal user.
   * Called by frontend: DELETE /auth/telegram/unlink
   */
  public async unlinkAccount(userId: number): Promise<void> {
    try {
      const telegramUser = await prismaTelegram.telegramUser.findFirst({
        where: { linkedUserId: userId },
      });

      if (!telegramUser) {
        throw new TelegramAccountNotLinkedError();
      }

      await prismaTelegram.telegramUser.update({
        where: { id: telegramUser.id },
        data: { linkedUserId: null },
      });

      logDeduplicator.info('TelegramService: Account unlinked', {
        userId,
        telegramId: telegramUser.telegramId.toString(),
      });
    } catch (error) {
      if (error instanceof TelegramError) {
        throw error;
      }
      logDeduplicator.error('TelegramService: Error unlinking account', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
