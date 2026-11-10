import { describe, expect, it } from 'vitest';

import {
  PASSWORD_RESET_RESEND_SECONDS,
  authCallbackUrl,
  isExpiredOrUsedAuthLink,
  isPasswordResetRateLimited,
  isRecoveryAuthCallback,
  parseAuthCallbackParams,
  passwordResetRemaining,
} from './authRedirect';

describe('auth callback redirects', () => {
  it('builds the release-identity callback and ignores the Site URL', () => {
    expect(authCallbackUrl('healthfolio')).toBe('healthfolio://auth/callback');
    expect(authCallbackUrl(' healthfolio:// ')).toBe('healthfolio://auth/callback');
    expect(authCallbackUrl('healthfolio')).not.toContain('localhost');
  });

  it('reads recovery tokens from the query or the fragment', () => {
    expect(
      parseAuthCallbackParams('healthfolio://auth/callback?code=abc&type=recovery'),
    ).toMatchObject({ code: 'abc', type: 'recovery' });
    expect(
      parseAuthCallbackParams(
        'healthfolio://auth/callback#access_token=token&refresh_token=refresh&type=recovery',
      ),
    ).toMatchObject({ access_token: 'token', refresh_token: 'refresh', type: 'recovery' });
    expect(
      parseAuthCallbackParams('healthfolio://auth/callback?token_hash=hash&type=recovery'),
    ).toMatchObject({ token_hash: 'hash', type: 'recovery' });
  });

  it('recognizes recovery and a used or expired link', () => {
    expect(isRecoveryAuthCallback({ type: 'recovery' })).toBe(true);
    expect(isRecoveryAuthCallback({ code: 'abc' }, 'recovery')).toBe(true);
    expect(isRecoveryAuthCallback({ type: 'signup' })).toBe(false);
    expect(
      isExpiredOrUsedAuthLink({
        error_code: 'otp_expired',
        error_description: 'Email link is invalid or has expired',
      }),
    ).toBe(true);
    expect(isExpiredOrUsedAuthLink({ error_description: 'Email link is invalid or has expired' })).toBe(
      true,
    );
  });

  it('counts down the 60-second resend limit instead of surfacing HTTP 429', () => {
    const availableAt = 1_000 + PASSWORD_RESET_RESEND_SECONDS * 1000;
    expect(passwordResetRemaining(availableAt, 1_000)).toBe(60);
    expect(passwordResetRemaining(availableAt, availableAt + 10)).toBe(0);
    expect(isPasswordResetRateLimited({ status: 429, message: 'For security purposes, you can only request this after 60 seconds.' })).toBe(
      true,
    );
    expect(isPasswordResetRateLimited({ message: 'Email link is invalid or has expired' })).toBe(false);
  });
});
