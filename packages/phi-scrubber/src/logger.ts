import pino, { type Logger as PinoLogger } from 'pino';

import { scrub } from './scrub.js';

export interface LogContext {
  [key: string]: unknown;
}

/**
 * PHI-safe logger. Every context object is scrubbed before it reaches pino,
 * so PHI-shaped keys can never land in stdout/stderr. Use this everywhere;
 * never call console.* directly in production code.
 */
export class Logger {
  private readonly base: PinoLogger;

  constructor(base?: PinoLogger) {
    this.base =
      base ??
      pino({
        level: process.env.LOG_LEVEL ?? 'info',
        // Redact common token-ish keys at the pino layer too (defense in depth).
        redact: {
          paths: ['token', 'accessToken', 'refreshToken', 'authorization', 'password', 'codeHash'],
          censor: '[REDACTED]',
        },
      });
  }

  /** Create a child logger that carries (scrubbed) bindings on every line. */
  child(bindings: LogContext): Logger {
    return new Logger(this.base.child(scrub(bindings)));
  }

  info(message: string, context?: LogContext): void {
    this.base.info(context ? scrub(context) : {}, message);
  }

  warn(message: string, context?: LogContext): void {
    this.base.warn(context ? scrub(context) : {}, message);
  }

  debug(message: string, context?: LogContext): void {
    this.base.debug(context ? scrub(context) : {}, message);
  }

  error(message: string, error?: unknown, context?: LogContext): void {
    const merged: LogContext = { ...(context ?? {}) };
    if (error instanceof Error) {
      // Keep the error type + message + stack, but scrub the rest of the context.
      // Error messages themselves must never carry PHI (enforced by convention).
      merged.errorName = error.name;
      merged.errorMessage = error.message;
      merged.stack = error.stack;
    } else if (error !== undefined) {
      merged.error = error;
    }
    this.base.error(scrub(merged), message);
  }
}

/** Shared default logger instance. */
export const logger = new Logger();
