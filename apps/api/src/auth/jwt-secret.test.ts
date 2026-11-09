import { describe, expect, it } from 'vitest';

import { resolveJwtSecret } from './jwt-secret.js';

describe('JWT secret', () => {
  it('refuses the insecure fallback in production', () => {
    expect(() => resolveJwtSecret(undefined, 'production')).toThrow(/JWT_SECRET/);
    expect(() => resolveJwtSecret('dev-insecure-secret', 'production')).toThrow(/JWT_SECRET/);
    expect(resolveJwtSecret('real-secret', 'production')).toBe('real-secret');
    expect(resolveJwtSecret(undefined, 'development')).toBe('dev-insecure-secret');
  });
});
