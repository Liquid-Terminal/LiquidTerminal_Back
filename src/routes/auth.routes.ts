import express, { Request, Response, RequestHandler } from "express";
import { AuthService } from "../services/auth.service";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const authService = new AuthService();
const prisma = new PrismaClient();

// Endpoint pour authentifier un utilisateur
router.post("/", (async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const { privyUserId, name } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Token manquant." });
    }

    const payload = await authService.verifyToken(token);

    if (payload.sub !== privyUserId) {
      return res.status(400).json({ message: "PrivyUserId invalide." });
    }

    const user = await authService.findOrCreateUser(payload, name);
    res.status(200).json({ message: "Utilisateur authentifié.", user });
  } catch (error) {
    console.error("Erreur lors de l'authentification :", error);
    res.status(500).json({ message: "Erreur interne ou token invalide." });
  }
}) as RequestHandler);

// Ajouter cette nouvelle route
router.get("/user/:privyUserId", (async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { privyUserId: req.params.privyUserId }
    });

    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    res.json(user);
  } catch (error) {
    console.error("Erreur lors de la récupération de l'utilisateur:", error);
    res.status(500).json({ message: "Erreur interne du serveur" });
  }
}) as RequestHandler);

export default router;
