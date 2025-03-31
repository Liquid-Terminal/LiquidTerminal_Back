import express, { Request, Response, RequestHandler } from "express";
import { UserTransactionsService } from "../../services/explorer/userTransactions.service";

const router = express.Router();
const userTransactionsService = new UserTransactionsService();

// Endpoint pour récupérer les transactions d'un wallet
router.get("/:address/transactions", (async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    
    // Vérifier que l'adresse est au format hexadécimal
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({
        error: 'Invalid address format',
        message: 'Address must be a 42-character hexadecimal string starting with 0x'
      });
    }
    
    const transactions = await userTransactionsService.getUserTransactions(address);
    res.json(transactions);
  } catch (error) {
    console.error("Erreur lors de la récupération des transactions:", error);
    res.status(500).json({ message: "Erreur interne du serveur" });
  }
}) as RequestHandler);

export default router; 