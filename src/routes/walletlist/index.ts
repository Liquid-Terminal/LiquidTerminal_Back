import express from 'express';
import walletListRoutes from './walletlist.routes';

const router = express.Router();

// Mount walletlist routes (includes both walletlists and items)
router.use('/', walletListRoutes);

export default router;
