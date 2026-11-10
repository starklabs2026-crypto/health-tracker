export const PASSWORD_RESET_RESEND_SECONDS = 60;

export function authCallbackUrl(urlScheme: string): string {
  const scheme = urlScheme.trim().replace(/:\/\/$/, '').split(':')[0] || 'healthfolio';
  return `${scheme}://auth/callback`;
}

export function parseAuthCallbackParams(callbackUrl: string): Record<string, string> {
  const url = new URL(callbackUrl);
  const merged: Record<string, string> = {};
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  for (const source of [url.searchParams, new URLSearchParams(hash)]) {
    source.forEach((value, key) => {
      merged[key] = value;
    });
  }
  return merged;
}

export function isRecoveryAuthCallback(
  params: Record<string, string>,
  redirectType?: string | null,
): boolean {
  const markers = [params.type, params.flow, redirectType]
    .map((value) => (value ?? '').trim().toLowerCase())
    .filter((value) => value.length > 0);
  return markers.includes('recovery');
}

export function isExpiredOrUsedAuthLink(params: Record<string, string>): boolean {
  const code = (params.error_code ?? '').toLowerCase();
  if (code === 'otp_expired' || code === 'otp_disabled') return true;
  const description = [params.error_description, params.error, params.message]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase();
  return (
    description.includes('expired') ||
    description.includes('invalid or has expired') ||
    (description.includes('invalid') && description.includes('link'))
  );
}

export function passwordResetRemaining(availableAt: number | null, now = Date.now()): number {
  if (availableAt == null) return 0;
  return Math.max(0, Math.ceil((availableAt - now) / 1000));
}

export function isPasswordResetRateLimited(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { status?: number; code?: string; message?: string };
  if (candidate.status === 429 || candidate.code === 'over_request_rate_limit') return true;
  const message = (candidate.message ?? '').toLowerCase();
  return (
    message.includes('rate limit') ||
    message.includes('too many') ||
    message.includes('only request this after') ||
    message.includes('security purposes')
  );
}
