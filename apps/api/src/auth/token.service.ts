import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import type { AuthUser } from '../common/current-user.decorator.js';

/** Claims carried by an HS256 access token. */
export interface AccessTokenPayload {
  sub: string;
  email: string | null;
  phone: string | null;
}

@Injectable()
export class TokenService {
  constructor(private readonly jwt: JwtService) {}

  /** Sign a short-lived access token (TTL configured on the JwtModule). */
  signAccessToken(user: AuthUser): string {
    const payload: AccessTokenPayload = { sub: user.id, email: user.email, phone: user.phone };
    return this.jwt.sign(payload);
  }

  /** Verify + decode an access token. Throws if invalid/expired. */
  verifyAccessToken(token: string): AccessTokenPayload {
    return this.jwt.verify<AccessTokenPayload>(token);
  }
}
