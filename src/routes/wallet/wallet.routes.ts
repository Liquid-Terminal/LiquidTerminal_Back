import express, { Request, Response, RequestHandler } from "express";
import { WalletService } from "../../services/wallet/wallet.service";
import prisma from "../../lib/prisma";
import { marketRateLimiter } from "../../middleware/apiRateLimiter";
import { 
  WalletAlreadyExistsError, 
  UserNotFoundError,
  WalletError 
} from "../../errors/wallet.errors";
import { walletCreateSchema, getWalletsByUserSchema } from "../../schemas/wallet.schema";
import { logDeduplicator } from "../../utils/logDeduplicator";

const router = express.Router();
const walletService = new WalletService();

// Appliquer le rate limiting
router.use(marketRateLimiter);

// Endpoint pour ajouter un wallet
router.post("/", (async (req: Request, res: Response) => {
  try {
    const result = walletCreateSchema.safeParse(req.body);
    
    if (!result.success) {
      logDeduplicator.warn('Validation error', { errors: result.error.errors });
      return res.status(400).json({ 
        success: false,
        error: "Données invalides",
        code: "VALIDATION_ERROR",
        details: result.error.errors
      });
    }

    const { privyUserId, address } = result.data;
    const wallet = await walletService.addWallet(privyUserId, address);
    
    logDeduplicator.info('Wallet added successfully', { 
      address: wallet.address,
      userId: wallet.userId
    });
    
    res.status(201).json({ 
      success: true,
      message: "Wallet ajouté avec succès.", 
      wallet 
    });
  } catch (error) {
    logDeduplicator.error('Error adding wallet:', { error, body: req.body });
    
    if (error instanceof WalletAlreadyExistsError ||
        error instanceof UserNotFoundError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({ 
      success: false,
      error: "Erreur interne du serveur.",
      code: "INTERNAL_SERVER_ERROR"
    });
  }
}) as RequestHandler);

// Endpoint pour récupérer les wallets d'un utilisateur
router.get("/user/:privyUserId", (async (req: Request, res: Response) => {
  try {
    const result = getWalletsByUserSchema.safeParse({ privyUserId: req.params.privyUserId });
    
    if (!result.success) {
      logDeduplicator.warn('Validation error', { errors: result.error.errors });
      return res.status(400).json({ 
        success: false,
        error: "Données invalides",
        code: "VALIDATION_ERROR",
        details: result.error.errors
      });
    }

    const { privyUserId } = result.data;
    logDeduplicator.info('Fetching wallets for user', { privyUserId });

    const user = await prisma.user.findUnique({
      where: { privyUserId }
    });

    if (!user) {
      logDeduplicator.warn('User not found', { privyUserId });
      return res.status(404).json({ 
        success: false,
        error: "Utilisateur non trouvé",
        code: "USER_NOT_FOUND"
      });
    }

    const wallets = await walletService.getWalletsByUser(user.id);
    logDeduplicator.info('Wallets retrieved successfully', { 
      privyUserId, 
      userId: user.id,
      count: wallets.data.length,
      total: wallets.pagination.total
    });

    res.json({
      success: true,
      data: wallets.data,
      pagination: wallets.pagination
    });
  } catch (error) {
    logDeduplicator.error('Error retrieving wallets:', { 
      error, 
      privyUserId: req.params.privyUserId 
    });

    if (error instanceof WalletError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({ 
      success: false,
      error: "Erreur interne du serveur",
      code: "INTERNAL_SERVER_ERROR"
    });
  }
}) as RequestHandler);

export default router;

