import { Router } from 'express';
import { StrictListService } from '../services/strictList.service';

const router = Router();
const strictListService = new StrictListService();

// Route pour la Strict List
router.get('/markets/strict', async (req, res) => {
  try {
    const strictMarkets = await strictListService.getStrictMarketsData();
    res.json(strictMarkets);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch strict market data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
