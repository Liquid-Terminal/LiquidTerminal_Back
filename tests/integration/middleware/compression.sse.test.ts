/**
 * SSE must reach the client event by event even though the app compresses
 * responses: the plain `compression()` it used to mount held a stream written
 * without `res.flush()` until the response ended.
 */
import express, { RequestHandler } from 'express';
import http from 'http';
import { AddressInfo } from 'net';
import compression from 'compression';
import { compressionMiddleware } from '../../../src/middleware/compression.middleware';

const EVENTS = 4;
const EVENT_INTERVAL_MS = 100;

function buildApp(middleware: RequestHandler): express.Express {
  const app = express();
  app.use(middleware);
  app.get('/sse', (_req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.flushHeaders();
    let sent = 0;
    const timer = setInterval(() => {
      res.write(`data: ${JSON.stringify({ sent, pad: 'x'.repeat(200) })}\n\n`);
      sent += 1;
      if (sent === EVENTS) {
        clearInterval(timer);
        res.end();
      }
    }, EVENT_INTERVAL_MS);
  });
  app.get('/json', (_req, res) => {
    res.json({ rows: Array.from({ length: 500 }, (_, i) => ({ i, name: `row-${i}` })) });
  });
  return app;
}

interface Probe {
  firstChunkMs: number;
  totalMs: number;
  contentEncoding: string | undefined;
}

function probe(app: express.Express, path: string): Promise<Probe> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      const start = Date.now();
      let firstChunkMs = -1;
      const req = http.get(
        { host: '127.0.0.1', port, path, headers: { 'Accept-Encoding': 'gzip, deflate, br' } },
        (res) => {
          res.on('data', () => {
            if (firstChunkMs < 0) firstChunkMs = Date.now() - start;
          });
          res.on('end', () => {
            server.close();
            resolve({
              firstChunkMs,
              totalMs: Date.now() - start,
              contentEncoding: res.headers['content-encoding'],
            });
          });
        }
      );
      req.on('error', (error) => {
        server.close();
        reject(error);
      });
    });
  });
}

describe('compressionMiddleware', () => {
  it('streams SSE uncompressed, one event at a time', async () => {
    const result = await probe(buildApp(compressionMiddleware), '/sse');
    expect(result.contentEncoding).toBeUndefined();
    // The first event lands well before the second one is even written.
    expect(result.firstChunkMs).toBeLessThan(EVENT_INTERVAL_MS * 1.8);
    expect(result.totalMs).toBeGreaterThanOrEqual(EVENTS * EVENT_INTERVAL_MS - 20);
  });

  it('still compresses regular JSON responses', async () => {
    const result = await probe(buildApp(compressionMiddleware), '/json');
    expect(['br', 'gzip']).toContain(result.contentEncoding);
  });

  it('documents the bug it fixes: plain compression() holds SSE until the end', async () => {
    const result = await probe(buildApp(compression()), '/sse');
    expect(result.contentEncoding).toBeDefined();
    expect(result.firstChunkMs).toBeGreaterThanOrEqual((EVENTS - 1) * EVENT_INTERVAL_MS);
  });
});
