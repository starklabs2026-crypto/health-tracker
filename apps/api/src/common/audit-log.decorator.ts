import { SetMetadata } from '@nestjs/common';

export const AUDIT_LOG_KEY = 'audit_log';

export interface AuditLogMeta {
  action: string;
  entityType: string;
}

/**
 * Marks a controller method as PHI-touching; the AuditInterceptor writes an
 * AuditLog row on success (playbook §1.1.4). Records actor, target, action,
 * entityType, entityId.
 *
 *   @AuditLog('update', 'user')
 *   @Put('me') updateMe(...) { ... }
 */
export const AuditLog = (action: string, entityType: string): MethodDecorator =>
  SetMetadata(AUDIT_LOG_KEY, { action, entityType } satisfies AuditLogMeta);
