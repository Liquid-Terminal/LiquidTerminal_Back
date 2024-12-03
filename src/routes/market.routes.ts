// src/routes/market.routes.ts
import { Router } from 'express';
import { MarketService } from '../services/market.service';

const router = Router();
const marketService = new MarketService();

router.get('/markets', async (req, res) => {
  try {
    const markets = await marketService.getMarketsData();
    res.json(markets);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch market data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;