import { api } from '../api/client';
import { clearTokens, getTokens } from './tokenStorage';

/** Revoke the refresh token server-side (best effort) and clear local tokens. */
export async function signOut(): Promise<void> {
  const tokens = await getTokens();
  if (tokens) {
    try {
      await api.post('/auth/logout', { refreshToken: tokens.refreshToken });
    } catch {
      // best-effort; clear locally regardless
    }
  }
  await clearTokens();
}
