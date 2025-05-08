import express, { Request, Response, RequestHandler } from "express";
import { WalletService } from "../../services/wallet/wallet.service";
import prisma from "../../lib/prisma";
import { marketRateLimiter } from "../../middleware/apiRateLimiter";
import { 
  WalletAlreadyExistsError, 
  UserNotFoundError,
  WalletError 
} from "../../errors/wallet.errors";
import { walletCreateSchema, getWalletsByUserSchema, walletUpdateSchema } from "../../schemas/wallet.schema";
import { logDeduplicator } from "../../utils/logDeduplicator";

const router = express.Router();
const walletService = new WalletService();

// Appliquer le rate limiting
router.use(marketRateLimiter);

// Endpoint pour ajouter un wallet
router.post("/", (async (req: Request, res: Response) => {
  try {
    // Vérifier si privyUserId est présent dans le corps de la requête
    if (!req.body.privyUserId) {
      logDeduplicator.warn('Missing privyUserId in request body');
      return res.status(400).json({ 
        success: false,
        error: "privyUserId est requis",
        code: "MISSING_PRIVY_USER_ID"
      });
    }

    const { privyUserId, address, name } = req.body;
    
    // Valider l'adresse et le nom
    const result = walletCreateSchema.safeParse({ address, name });
    
    if (!result.success) {
      logDeduplicator.warn('Validation error', { errors: result.error.errors });
      return res.status(400).json({ 
        success: false,
        error: "Données invalides",
        code: "VALIDATION_ERROR",
        details: result.error.errors
      });
    }

    const userWallet = await walletService.addWallet(privyUserId, address, name);
    
    // Vérifier si userWallet et userWallet.Wallet existent
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
      userWallet 
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

// Endpoint pour supprimer un wallet d'un utilisateur
router.delete("/user/:userId/wallet/:walletId", (async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const walletId = parseInt(req.params.walletId, 10);
    
    if (isNaN(userId) || isNaN(walletId)) {
      logDeduplicator.warn('Invalid user or wallet ID', { userId, walletId });
      return res.status(400).json({ 
        success: false,
        error: "ID d'utilisateur ou de wallet invalide",
        code: "INVALID_ID"
      });
    }
    
    logDeduplicator.info('Removing wallet from user', { userId, walletId });
    
    await walletService.removeWalletFromUser(walletId, userId);
    
    logDeduplicator.info('Wallet removed from user successfully', { userId, walletId });
    
    res.json({ 
      success: true,
      message: "Wallet supprimé de l'utilisateur avec succès."
    });
  } catch (error) {
    logDeduplicator.error('Error removing wallet from user:', { 
      error, 
      userId: req.params.userId,
      walletId: req.params.walletId
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

// Mettre à jour le nom d'un wallet pour un utilisateur
router.patch('/user/:privyUserId/wallet/:walletId/name', (async (req, res) => {
  try {
    const { privyUserId } = req.params;
    const walletId = parseInt(req.params.walletId);
    const { name } = req.body;

    if (isNaN(walletId)) {
      return res.status(400).json({ error: 'Invalid wallet ID' });
    }

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Valider le nom
    const validationResult = walletUpdateSchema.shape.name.safeParse(name);
    if (!validationResult.success) {
      return res.status(400).json({ error: validationResult.error.errors });
    }

    // Trouver l'utilisateur
    const user = await prisma.user.findUnique({
      where: { privyUserId }
    });

    if (!user) {
      logDeduplicator.error('User not found', { privyUserId });
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedUserWallet = await walletService.updateWalletName(user.id, walletId, name);

    logDeduplicator.info('Wallet name updated successfully', {
      userId: user.id,
      walletId,
      name
    });

    res.json(updatedUserWallet);
  } catch (error) {
    if (error instanceof WalletError) {
      logDeduplicator.error('Error updating wallet name:', {
        error: error.message,
        code: error.code,
        privyUserId: req.params.privyUserId,
        walletId: req.params.walletId
      });
      return res.status(error.statusCode).json({ error: error.message });
    }

    logDeduplicator.error('Error updating wallet name:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      privyUserId: req.params.privyUserId,
      walletId: req.params.walletId
    });
    res.status(500).json({ error: 'Failed to update wallet name' });
  }
}) as RequestHandler);

export default router;

