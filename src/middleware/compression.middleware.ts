import compression from 'compression';
import { Request, Response } from 'express';

/**
 * Gzip / Brotli for regular responses, never for Server-Sent Events.
 *
 * A compressed SSE response sits in the zlib buffer until it fills or the
 * response ends, unless the handler calls `res.flush()` after every write —
 * the Hyperfolio positions proxy doesn't, so its protocols reached the browser
 * in one burst at the end instead of one by one, heartbeats included.
 */
export const compressionMiddleware = compression({
  filter: (req: Request, res: Response): boolean => {
    const type = res.getHeader('Content-Type');
    if (typeof type === 'string' && type.startsWith('text/event-stream')) {
      return false;
    }
    return compression.filter(req, res);
  },
});
