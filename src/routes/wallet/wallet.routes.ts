import express, { Request, Response, RequestHandler } from "express";
import { WalletService } from "../../services/wallet/wallet.service";
import { marketRateLimiter } from "../../middleware/apiRateLimiter";
import { validatePrivyToken } from "../../middleware/authMiddleware";
import { 
  WalletAlreadyExistsError, 
  UserNotFoundError,
  WalletError,
  WalletLimitExceededError
} from "../../errors/wallet.errors";
import {
  validateCreateWallet,
  validateUpdateWallet,
  validateWalletQuery
} from "../../middleware/validation/wallet.validation";
import { logDeduplicator } from "../../utils/logDeduplicator";
import { prisma } from "../../core/prisma.service";

const router = express.Router();
const walletService = new WalletService();

// Rate limiting
router.use(marketRateLimiter);

// ========== WALLET ROUTES ==========

// Créer un wallet
router.post("/", validatePrivyToken, validateCreateWallet, (async (req: Request, res: Response) => {
  try {
    const privyUserId = req.user?.sub;
    if (!privyUserId) {
      return res.status(401).json({ success: false, error: 'User not authenticated', code: 'UNAUTHENTICATED' });
    }

    // Récupère l'utilisateur depuis la DB
    const user = await prisma.user.findUnique({ where: { privyUserId } });
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND' });
    }

    const { address, name } = req.body;

    const userWallet = await walletService.addWallet(privyUserId, address, name);
    
    if (!userWallet || !userWallet.Wallet) {
      logDeduplicator.error('Invalid userWallet structure', { userWallet });
      return res.status(500).json({ 
        success: false,
        error: "Structure de réponse invalide",
        code: "INVALID_RESPONSE_STRUCTURE"
      });
    }
    
    logDeduplicator.info('Wallet added successfully', { 
      address: userWallet.Wallet.address,
      userId: userWallet.userId,
      walletId: userWallet.walletId,
      name: userWallet.Wallet.name
    });
    
    res.status(201).json({ 
      success: true,
      message: "Wallet ajouté avec succès.", 
      data: userWallet 
    });
  } catch (error) {
    logDeduplicator.error('Error adding wallet:', { error, body: req.body });
    
    if (error instanceof WalletAlreadyExistsError ||
        error instanceof UserNotFoundError ||
        error instanceof WalletLimitExceededError) {
      return res.status((error as any).statusCode).json({
        success: false,
        error: (error as any).message,
        code: (error as any).code
      });
    }

    res.status(500).json({ 
      success: false,
      error: "Erreur interne du serveur.",
      code: "INTERNAL_SERVER_ERROR"
    });
  }
}) as RequestHandler);

// Lister mes wallets
router.get("/my-wallets", validatePrivyToken, (async (req: Request, res: Response) => {
  try {
    const privyUserId = req.user?.sub;
    if (!privyUserId) {
      return res.status(401).json({ success: false, error: 'User not authenticated', code: 'UNAUTHENTICATED' });
    }

    // Récupère l'utilisateur depuis la DB
    const user = await prisma.user.findUnique({ where: { privyUserId } });
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND' });
    }

    logDeduplicator.info('Fetching wallets for user', { userId: user.id });

    const wallets = await walletService.getWalletsByUser(user.id);
    logDeduplicator.info('Wallets retrieved successfully', { 
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
    logDeduplicator.error('Error retrieving wallets:', { error, privyUserId: req.user?.sub });

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

// Lister tous les wallets (avec filtres)
router.get("/", validateWalletQuery, (async (req: Request, res: Response) => {
  try {
    const wallets = await walletService.getAll(req.query);
    res.json({
      success: true,
      data: wallets.data,
      pagination: wallets.pagination
    });
  } catch (error) {
    logDeduplicator.error('Error fetching all wallets:', { error });

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

// Récupérer un wallet par ID
router.get("/:id", (async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid ID format', code: 'INVALID_ID_FORMAT' });
    }

    const wallet = await walletService.getById(id);
    res.json({
      success: true,
      data: wallet
    });
  } catch (error) {
    logDeduplicator.error('Error fetching wallet:', { error, id: req.params.id });

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

// Modifier un wallet
router.put("/:id", validatePrivyToken, validateUpdateWallet, (async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid ID format', code: 'INVALID_ID_FORMAT' });
    }

    const privyUserId = req.user?.sub;
    if (!privyUserId) {
      return res.status(401).json({ success: false, error: 'User not authenticated', code: 'UNAUTHENTICATED' });
    }

    // Récupère l'utilisateur depuis la DB
    const user = await prisma.user.findUnique({ where: { privyUserId } });
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND' });
    }

    const { name } = req.body;

    const updatedWallet = await walletService.updateWalletName(user.id, id, name);

    logDeduplicator.info('Wallet updated successfully', {
      userId: user.id,
      walletId: id,
      name
    });

    res.json({
      success: true,
      message: "Wallet modifié avec succès.",
      data: updatedWallet
    });
  } catch (error) {
    logDeduplicator.error('Error updating wallet:', { error, id: req.params.id, body: req.body });

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

// Supprimer un wallet
router.delete("/:id", validatePrivyToken, (async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid ID format', code: 'INVALID_ID_FORMAT' });
    }

    const privyUserId = req.user?.sub;
    if (!privyUserId) {
      return res.status(401).json({ success: false, error: 'User not authenticated', code: 'UNAUTHENTICATED' });
    }

    // Récupère l'utilisateur depuis la DB
    const user = await prisma.user.findUnique({ where: { privyUserId } });
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND' });
    }
    
    logDeduplicator.info('Removing wallet', { userId: user.id, walletId: id });
    
    await walletService.removeWalletFromUser(id, user.id);
    
    logDeduplicator.info('Wallet removed successfully', { userId: user.id, walletId: id });
    
    res.json({ 
      success: true,
      message: "Wallet supprimé avec succès."
    });
  } catch (error) {
    logDeduplicator.error('Error removing wallet:', { error, id: req.params.id });
    
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

