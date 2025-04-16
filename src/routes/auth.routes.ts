import { Router, Request, Response } from "express";
import { AuthService } from "../services/auth/auth.service";
import { validatePrivyToken } from "../middleware/authMiddleware";
import { validateLogin, validateUserParams } from "../middleware/validation/authValidation.middleware";
import { marketRateLimiter } from "../middleware/apiRateLimiter";
import { UserNotFoundError } from "../errors/auth.errors";
import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";
import { logDeduplicator } from "../utils/logDeduplicator";

const router = Router();
const authService = AuthService.getInstance();
const prisma = new PrismaClient();

// Appliquer le rate limiting à toutes les routes d'authentification
router.use(marketRateLimiter);

// Route de connexion
router.post("/login", validatePrivyToken, validateLogin, (req: Request, res: Response): void => {
  const { privyUserId, name } = req.body;

  if (!req.user) {
    logger.warn('Login attempt without authentication', { privyUserId, name });
    res.status(401).json({ 
      success: false,
      message: "Not authenticated",
      code: "NOT_AUTHENTICATED"
    });
    return;
  }

  if (req.user.sub !== privyUserId) {
    logger.warn('Login attempt with invalid Privy User ID', { 
      tokenSub: req.user.sub, 
      providedSub: privyUserId, 
      name 
    });
    res.status(400).json({ 
      success: false,
      message: "Invalid Privy User ID",
      code: "INVALID_PRIVY_USER_ID"
    });
    return;
  }

  authService.findOrCreateUser(req.user, name)
    .then(user => {
      logDeduplicator.info('User authenticated successfully', { privyUserId, name });
      res.status(200).json({ 
        success: true,
        message: "User authenticated successfully", 
        user 
      });
    })
    .catch(error => {
      logger.error("Authentication error:", { error, privyUserId, name });
      
      if (error instanceof UserNotFoundError) {
        res.status(error.statusCode).json({ 
          success: false,
          message: error.message,
          code: error.code
        });
        return;
      }
      
      res.status(500).json({ 
        success: false,
        message: "Internal server error",
        code: "INTERNAL_SERVER_ERROR"
      });
    });
});

// Route pour récupérer les informations d'un utilisateur
router.get("/user/:privyUserId", validatePrivyToken, validateUserParams, (req: Request, res: Response): void => {
  if (req.user?.sub !== req.params.privyUserId) {
    logger.warn('Unauthorized access attempt', { 
      tokenSub: req.user?.sub, 
      requestedSub: req.params.privyUserId 
    });
    res.status(403).json({ 
      success: false,
      message: "Unauthorized access",
      code: "UNAUTHORIZED_ACCESS"
    });
    return;
  }

  prisma.user.findUnique({
    where: { privyUserId: req.params.privyUserId }
  })
    .then(user => {
      if (!user) {
        logger.warn('User not found', { privyUserId: req.params.privyUserId });
        res.status(404).json({ 
          success: false,
          message: "User not found",
          code: "USER_NOT_FOUND"
        });
        return;
      }
      
      logDeduplicator.info('User retrieved successfully', { privyUserId: req.params.privyUserId });
      res.status(200).json({ 
        success: true,
        message: "User retrieved successfully",
        user 
      });
    })
    .catch(error => {
      logger.error("Error retrieving user:", { error, privyUserId: req.params.privyUserId });
      
      if (error instanceof UserNotFoundError) {
        res.status(error.statusCode).json({ 
          success: false,
          message: error.message,
          code: error.code
        });
        return;
      }
      
      res.status(500).json({ 
        success: false,
        message: "Internal server error",
        code: "INTERNAL_SERVER_ERROR"
      });
    });
});

export default router;
