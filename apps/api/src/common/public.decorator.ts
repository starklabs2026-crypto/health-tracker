import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route (or controller) as public — exempt from the global JwtAuthGuard.
 * Used on /auth/*, /dev/* and /health (R.2: everything else requires auth).
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
