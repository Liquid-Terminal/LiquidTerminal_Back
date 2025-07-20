import express from 'express';
import readListRoutes from './readlist.routes';

const router = express.Router();

// Mount readlist routes (includes both readlists and items)
router.use('/', readListRoutes);

export default router; 