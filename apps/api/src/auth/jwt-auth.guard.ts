import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import type { AuthUser } from '../common/current-user.decorator.js';
import { IS_PUBLIC_KEY } from '../common/public.decorator.js';
import { TokenService } from './token.service.js';

/**
 * Global authentication guard (R.2). Routes/controllers marked @Public() pass
 * through; everything else requires a valid Bearer access token, whose claims
 * become req.user.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header');
    }

    try {
      const payload = this.tokens.verifyAccessToken(header.slice('Bearer '.length));
      request.user = { id: payload.sub, email: payload.email, phone: payload.phone };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
