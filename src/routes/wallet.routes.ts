import express, { Request, Response, RequestHandler } from "express";
import { WalletService } from "../services/wallet.service";
import prisma from "../lib/prisma";

const router = express.Router();
const walletService = new WalletService();

// Endpoint pour ajouter un wallet
router.post("/", (async (req: Request, res: Response) => {
  try {
    const { privyUserId, address } = req.body;

    if (!privyUserId || !address) {
      return res.status(400).json({ message: "PrivyUserId et address sont requis." });
    }

    const wallet = await walletService.addWallet(privyUserId, address);
    res.status(201).json({ message: "Wallet ajouté avec succès.", wallet });
  } catch (error: any) {
    console.error("Erreur lors de l'ajout du wallet :", error);
    res
      .status(error.message === "Ce wallet est déjà enregistré" ? 400 : 500)
      .json({ message: error.message || "Erreur interne du serveur." });
  }
}) as RequestHandler);

// Endpoint pour récupérer les wallets d'un utilisateur
router.get("/user/:privyUserId", (async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { privyUserId: req.params.privyUserId }
    });

    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // Utiliser le service pour récupérer les wallets
    const wallets = await walletService.getWalletsByUser(user.id);
    res.json(wallets);
  } catch (error) {
    console.error("Erreur lors de la récupération des wallets:", error);
    res.status(500).json({ message: "Erreur interne du serveur" });
  }
}) as RequestHandler);

// Endpoint pour récupérer les informations détaillées d'un wallet
router.get("/:address/info", (async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const walletInfo = await walletService.getWalletInfo(address);
    res.json(walletInfo);
  } catch (error) {
    console.error("Erreur lors de la récupération des infos du wallet:", error);
    res.status(500).json({ message: "Erreur interne du serveur" });
  }
}) as RequestHandler);

export default router;
