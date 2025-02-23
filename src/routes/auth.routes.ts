import { Router, Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { validatePrivyToken } from "../middleware/authMiddleware";
import { PrismaClient } from "@prisma/client";

const router = Router();
const authService = new AuthService();
const prisma = new PrismaClient();

router.post("/login", validatePrivyToken, (req: Request, res: Response): void => {
  const { privyUserId, name } = req.body;

  if (!req.user) {
    res.status(401).json({ message: "Non authentifié" });
    return;
  }

  if (req.user.sub !== privyUserId) {
    res.status(400).json({ message: "PrivyUserId invalide" });
    return;
  }

  authService.findOrCreateUser(req.user, name)
    .then(user => res.status(200).json({ message: "Utilisateur authentifié", user }))
    .catch(error => {
      console.error("Erreur lors de l'authentification:", error);
      res.status(500).json({ message: "Erreur interne du serveur" });
    });
});

router.get("/user/:privyUserId", validatePrivyToken, (req: Request, res: Response): void => {
  if (req.user?.sub !== req.params.privyUserId) {
    res.status(403).json({ message: "Accès non autorisé" });
    return;
  }

  prisma.user.findUnique({
    where: { privyUserId: req.params.privyUserId }
  })
    .then(user => {
      if (!user) {
        res.status(404).json({ message: "Utilisateur non trouvé" });
        return;
      }
      res.json(user);
    })
    .catch(error => {
      console.error("Erreur lors de la récupération de l'utilisateur:", error);
      res.status(500).json({ message: "Erreur interne du serveur" });
    });
});

export default router;
