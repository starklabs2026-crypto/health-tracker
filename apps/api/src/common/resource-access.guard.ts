import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';

import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from './current-user.decorator.js';

/**
 * Resolves the target profile for a document/reading request and enforces
 * access. PHASE 2: ownership only (actor must own the resource). PHASE 4 will
 * extend this with family-link role/permission checks. On no access we throw
 * 404 (not 403) so existence isn't leaked (playbook §4.1.2).
 */
@Injectable()
export class ResourceAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<
        Request & { user?: AuthUser; targetUserId?: string; params: Record<string, string> }
      >();
    const actor = req.user;
    if (!actor) throw new NotFoundException();

    const targetUserId = await this.resolveTargetUserId(req, actor.id);

    // Phase 2: only the owner may access. (Family links handled in Phase 4.)
    if (targetUserId !== actor.id) {
      throw new NotFoundException();
    }
    req.targetUserId = targetUserId;
    return true;
  }

  private async resolveTargetUserId(
    req: Request & { params: Record<string, string>; body: Record<string, unknown> },
    actorId: string,
  ): Promise<string> {
    const documentId = req.params.id;
    if (documentId) {
      const doc = await this.prisma.document.findFirst({
        where: { id: documentId, deletedAt: null },
        select: { ownerUserId: true },
      });
      if (!doc) throw new NotFoundException();
      return doc.ownerUserId;
    }

    const fromBody = req.body?.['ownerProfileId'];
    if (typeof fromBody === 'string') return fromBody;

    const fromQuery = (req.query as Record<string, unknown>)['profileId'];
    if (typeof fromQuery === 'string') return fromQuery;

    return actorId;
  }
}
