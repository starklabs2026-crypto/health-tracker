const DEV_FALLBACK = 'dev-insecure-secret';

/** Production must provide its own signing secret. Local runs may use the insecure fallback. */
export function resolveJwtSecret(secret: string | undefined, nodeEnv = process.env.NODE_ENV): string {
  const trimmed = secret?.trim();
  if (trimmed && trimmed !== DEV_FALLBACK) return trimmed;
  if (nodeEnv === 'production') {
    throw new Error('JWT_SECRET must be set to a unique value in production');
  }
  return DEV_FALLBACK;
}
