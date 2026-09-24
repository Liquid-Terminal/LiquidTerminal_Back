/**
 * /ws must not buffer without bound for a client that stopped reading: past
 * the backlog cap a public client is dropped (browsers reconnect and resync),
 * while readers keep receiving everything and the authenticated bot keeps its
 * backlog as before.
 */
import http from 'http';
import { AddressInfo } from 'net';
import WebSocket from 'ws';

const mockState = {
  onLiquidation: null as ((liquidations: unknown[]) => void) | null,
};

jest.mock('../../../src/utils/logDeduplicator', () => ({
  logDeduplicator: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../../src/services/liquidations/liquidations.ws.service', () => ({
  LiquidationsWebSocketService: {
    getInstance: () => ({
      onProcessedLiquidation: (cb: (liquidations: unknown[]) => void) => {
        mockState.onLiquidation = cb;
      },
    }),
  },
}));
jest.mock('../../../src/services/liquidations/sse-manager.service', () => ({
  SSEManagerService: { getInstance: () => ({}) },
}));
jest.mock('../../../src/services/orderbook/l4book.service', () => ({
  L4BookService: {
    getInstance: () => ({
      onSnapshot: () => undefined,
      onDelta: () => undefined,
      onUnavailable: () => undefined,
      shutdown: () => undefined,
    }),
  },
}));

const BOT_KEY = 'test-bot-key-0123456789';

const tick = (ms = 0): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function liquidation(i: number): Record<string, unknown> {
  return {
    tid: i,
    time_ms: 1_790_000_000_000 + i,
    coin: 'BTC',
    liquidated_user: '0xabc',
    notional_total: 1_000,
    // ~256 KB per message: the backlog grows fast without sending thousands of frames.
    padding: 'x'.repeat(256 * 1024),
  };
}

interface Client {
  ws: WebSocket;
  received: number;
}

async function connect(port: number, headers: Record<string, string> = {}): Promise<Client> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers });
  const client: Client = { ws, received: 0 };
  ws.on('message', (data) => {
    if (String(data).startsWith('{"type":"liquidation"')) client.received += 1;
  });
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });
  ws.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'liquidation' } }));
  await tick(50);
  return client;
}

describe('InternalWebSocketServer slow consumers', () => {
  let server: http.Server;
  let port: number;
  let wsServer: import('../../../src/websocket/ws.server').InternalWebSocketServer;

  beforeEach(async () => {
    jest.resetModules();
    process.env.TELEGRAM_BOT_API_KEY = BOT_KEY;
    const { InternalWebSocketServer } = require('../../../src/websocket/ws.server');
    wsServer = InternalWebSocketServer.getInstance();
    server = http.createServer();
    wsServer.initialize(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    port = (server.address() as AddressInfo).port;
  });

  afterEach(async () => {
    wsServer.shutdown();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    delete process.env.TELEGRAM_BOT_API_KEY;
  });

  /** Broadcast `count` large liquidations, yielding so readers can drain. */
  async function broadcast(count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      mockState.onLiquidation?.([liquidation(i)]);
      await tick(5);
    }
    await tick(300);
  }

  it('drops a public client that stops reading and keeps serving the others', async () => {
    const reader = await connect(port);
    const stalled = await connect(port);
    // Stop reading at the TCP level: frames pile up on the server side.
    (stalled.ws as unknown as { _socket: { pause(): void } })._socket.pause();
    expect(wsServer.getStats().totalConnections).toBe(2);

    await broadcast(80); // ~20 MB, far past the 4 MB cap plus kernel buffers

    expect(wsServer.getStats().totalConnections).toBe(1);
    expect(reader.received).toBe(80);
    reader.ws.close();
    stalled.ws.terminate();
  }, 30_000);

  it('keeps the authenticated bot connected whatever its backlog', async () => {
    const bot = await connect(port, { Authorization: `Bot ${BOT_KEY}` });
    (bot.ws as unknown as { _socket: { pause(): void } })._socket.pause();

    await broadcast(80);

    expect(wsServer.getStats().totalConnections).toBe(1);
    expect(wsServer.getStats().authenticatedConnections).toBe(1);
    bot.ws.terminate();
  }, 30_000);
});
