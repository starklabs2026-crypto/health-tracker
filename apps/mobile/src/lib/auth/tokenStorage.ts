import type { AuthTokens } from '@medical-tracker/shared-types';
import * as SecureStore from 'expo-secure-store';

// Tokens live in the OS keychain/keystore via expo-secure-store (PRD §9.2).
const ACCESS_KEY = 'mt.accessToken';
const REFRESH_KEY = 'mt.refreshToken';

export async function getTokens(): Promise<AuthTokens | null> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
  ]);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function setTokens(tokens: AuthTokens): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken),
  ]);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
  ]);
}
