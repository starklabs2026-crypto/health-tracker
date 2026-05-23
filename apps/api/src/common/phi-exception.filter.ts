import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { logger, scrub } from '@medical-tracker/phi-scrubber';
import type { Request, Response } from 'express';

/**
 * Global exception filter. Scrubs PHI from anything that would reach the client
 * or the logs. Unknown errors collapse to a generic 500 with no internals; HTTP
 * exceptions keep their status but their bodies are scrubbed (R.2: never return
 * PHI in error messages).
 */
@Catch()
export class PhiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const rawBody = isHttp ? exception.getResponse() : { message: 'Internal server error' };
    const body = typeof rawBody === 'string' ? { message: rawBody } : scrub(rawBody);

    logger.error('Request failed', exception, {
      method: request.method,
      path: request.path,
      status,
    });

    response.status(status).json({ statusCode: status, ...body });
  }
}
