import express from 'express';
import publicGoodRoutes from './publicgood.routes';

const router = express.Router();

// Mount publicgood routes
router.use('/', publicGoodRoutes);

export default router;

