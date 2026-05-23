import { Injectable, type NestMiddleware } from '@nestjs/common';
import { logger } from '@medical-tracker/phi-scrubber';
import type { NextFunction, Request, Response } from 'express';

/**
 * Request logger. Logs method + path + status + duration only — never the body
 * or query string, which can carry PHI (R.4: do not log full request bodies).
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    res.on('finish', () => {
      logger.info('request', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - start,
      });
    });
    next();
  }
}
