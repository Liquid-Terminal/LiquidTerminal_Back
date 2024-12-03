import { WebSocketServer } from 'ws'; // Import correct pour WebSocket en ESM
import type { Server } from 'http';
import { MarketService } from './services/market.service';

export function setupWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server });

  const marketService = new MarketService();

  wss.on('connection', (ws) => {
    console.log('Client connected via WebSocket');

    const interval = setInterval(async () => {
      try {
        const marketData = await marketService.getMarketsData();
        ws.send(JSON.stringify(marketData));
      } catch (error) {
        console.error('Error fetching market data:', error);
        ws.send(JSON.stringify({ error: 'Failed to fetch market data' }));
      }
    }, 3000);

    ws.on('close', () => {
      console.log('Client disconnected');
      clearInterval(interval);
    });
  });
}
