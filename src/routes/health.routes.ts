import { Router } from 'express';
import { logDeduplicator } from '../utils/logDeduplicator';

const router = Router();

router.get('/', (req, res) => {
  logDeduplicator.info('Health check called');
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

export default router; 