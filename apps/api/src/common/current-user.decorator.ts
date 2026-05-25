import { type ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';

/** The authenticated principal attached to the request by JwtAuthGuard. */
export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
}

/** Injects the authenticated user: `@CurrentUser() user: AuthUser`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    if (!request.user) {
      throw new Error('CurrentUser used on a route without JwtAuthGuard');
    }
    return request.user;
  },
);
