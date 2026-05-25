import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { logger } from '@medical-tracker/phi-scrubber';
import type { Request } from 'express';
import { type Observable, tap } from 'rxjs';

import { PrismaService } from '../prisma/prisma.service.js';
import { AUDIT_LOG_KEY, type AuditLogMeta } from './audit-log.decorator.js';
import type { AuthUser } from './current-user.decorator.js';

/**
 * Writes an AuditLog row after any handler annotated with @AuditLog() succeeds.
 * Actor = authenticated user. For Phase 1 (self-service /me endpoints) target ==
 * actor; Phase 4 extends this for cross-profile access. Never logs PHI — only
 * ids, action, and request metadata (R.2).
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<AuditLogMeta | undefined>(
      AUDIT_LOG_KEY,
      context.getHandler(),
    );
    if (!meta) return next.handle();

    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const actorId = req.user?.id;

    return next.handle().pipe(
      tap(() => {
        if (!actorId) return;
        void this.prisma.auditLog
          .create({
            data: {
              actorUserId: actorId,
              targetUserId: actorId,
              action: meta.action,
              entityType: meta.entityType,
              entityId: actorId,
              ip: req.ip ?? null,
              userAgent: req.headers['user-agent'] ?? null,
            },
          })
          .catch((error: unknown) => logger.error('Failed to write audit log', error));
      }),
    );
  }
}
