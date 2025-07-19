import express from 'express';
import readListRoutes from './readlist.routes';
import readListItemRoutes from './readlist-item.routes';

const router = express.Router();

// Mount readlist routes
router.use('/', readListRoutes);

// Mount readlist item routes
router.use('/items', readListItemRoutes);

export default router; 