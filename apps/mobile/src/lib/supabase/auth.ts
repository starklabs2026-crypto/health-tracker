import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import {
  GoogleSignin,
  isSuccessResponse,
  type SignInResponse,
} from '@react-native-google-signin/google-signin';
import type { EmailOtpType } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import identity from '../../../release-identity.json';
import { supabase } from './client';
import { publicRuntimeConfig } from '../config';
import { getMe } from '../api/endpoints';
import {
  authCallbackUrl,
  isExpiredOrUsedAuthLink,
  isRecoveryAuthCallback,
  parseAuthCallbackParams,
} from './authRedirect';

WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = 'apple' | 'google';

export class RecoveryLinkExpiredError extends Error {
  constructor() {
    super('This reset link is invalid or has expired. Send a new link and open the newest email.');
    this.name = 'RecoveryLinkExpiredError';
  }
}

let googleConfigured = false;

export function getAuthCallbackUrl(): string {
  return authCallbackUrl(identity.urlScheme);
}

async function sha256Hex(value: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
}

function getCallbackParams(callbackUrl: string): URLSearchParams {
  const url = new URL(callbackUrl);
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  return new URLSearchParams(`${url.search.slice(1)}&${hash}`);
}

function isTransientAuthError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return /network request failed|failed to fetch|network error|timeout|timed out/i.test(message);
}

async function withTransientRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isTransientAuthError(error)) throw error;
  }

  await new Promise((resolve) => setTimeout(resolve, 350));
  return operation();
}

function configureGoogleSignIn(): void {
  if (googleConfigured) return;

  const iosClientId = publicRuntimeConfig.googleIosClientId;
  const webClientId = publicRuntimeConfig.googleWebClientId;
  if (!iosClientId || !webClientId) {
    throw new Error('Google sign-in is not fully configured yet. Missing OAuth client IDs.');
  }

  GoogleSignin.configure({
    iosClientId,
    webClientId,
    scopes: ['openid', 'email', 'profile'],
  });
  googleConfigured = true;
}

function assertGoogleSuccess(response: SignInResponse) {
  if (!isSuccessResponse(response)) {
    throw new Error('Sign in was cancelled');
  }
  return response.data;
}

async function getGoogleAccessToken(): Promise<string | undefined> {
  try {
    const tokens = await GoogleSignin.getTokens();
    return tokens.accessToken;
  } catch {
    return undefined;
  }
}

export async function hasSupabaseSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}

export async function hasAppProfile(): Promise<boolean> {
  try {
    const me = await getMe();
    return Boolean(me.user.id);
  } catch {
    return false;
  }
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await withTransientRetry(() =>
    supabase.auth.signInWithPassword({ email, password }),
  );
  if (error) throw error;
}

export async function signUpWithPassword(email: string, password: string): Promise<boolean> {
  const emailRedirectTo = getAuthCallbackUrl();
  const { data, error } = await withTransientRetry(() =>
    supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo },
    }),
  );
  if (error) throw error;
  return Boolean(data.session);
}

export async function signInWithMagicLink(email: string): Promise<void> {
  const emailRedirectTo = getAuthCallbackUrl();
  const { error } = await withTransientRetry(() =>
    supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo, shouldCreateUser: false },
    }),
  );
  if (error) throw error;
}

export async function resetPasswordForEmail(email: string): Promise<void> {
  const redirectTo = getAuthCallbackUrl();
  const { error } = await withTransientRetry(() =>
    supabase.auth.resetPasswordForEmail(email, { redirectTo }),
  );
  if (error) throw error;
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function completeAuthCallback(callbackUrl: string): Promise<{ isRecovery: boolean }> {
  const params = parseAuthCallbackParams(callbackUrl);
  if (isExpiredOrUsedAuthLink(params)) {
    throw new RecoveryLinkExpiredError();
  }

  if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) throw error;
    return { isRecovery: isRecoveryAuthCallback(params) };
  }

  if (params.token_hash && params.type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: params.token_hash,
      type: emailOtpType(params.type),
    });
    if (error) throw expiredOrOriginal(error);
    return { isRecovery: isRecoveryAuthCallback(params) };
  }

  if (params.code) {
    const redirectType = await storedPkceRedirectType();
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw expiredOrOriginal(error);
    return { isRecovery: isRecoveryAuthCallback(params, redirectType) };
  }

  throw new Error('The sign-in link did not include a session.');
}

function emailOtpType(value: string): EmailOtpType {
  const allowed: EmailOtpType[] = [
    'signup',
    'invite',
    'magiclink',
    'recovery',
    'email_change',
    'email',
  ];
  return allowed.includes(value as EmailOtpType) ? (value as EmailOtpType) : 'email';
}

function expiredOrOriginal(error: unknown): Error {
  const message = error instanceof Error ? error.message : '';
  if (isExpiredOrUsedAuthLink({ error_description: message })) {
    return new RecoveryLinkExpiredError();
  }
  return error instanceof Error ? error : new Error('The sign-in link could not be opened.');
}

async function storedPkceRedirectType(): Promise<string | null> {
  const supabaseUrl = publicRuntimeConfig.supabaseUrl;
  if (!supabaseUrl) return null;
  const host = new URL(supabaseUrl).hostname.split('.')[0];
  const raw = await AsyncStorage.getItem(`sb-${host}-auth-token-code-verifier`);
  const type = raw?.split('/')[1]?.trim();
  return type || null;
}

export async function isNativeAppleSignInAvailable(): Promise<boolean> {
  return Platform.OS === 'ios' && AppleAuthentication.isAvailableAsync();
}

export async function signInWithApple(): Promise<void> {
  if (!(await isNativeAppleSignInAvailable())) {
    await signInWithOAuthProvider('apple');
    return;
  }

  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await sha256Hex(rawNonce);
  const state = Crypto.randomUUID();
  const credential = await AppleAuthentication.signInAsync({
    nonce: hashedNonce,
    state,
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (credential.state && credential.state !== state) {
    throw new Error('Apple sign-in could not be verified. Please try again.');
  }
  const identityToken = credential.identityToken;
  if (!identityToken) {
    throw new Error('Apple did not return an identity token.');
  }

  const { error } = await withTransientRetry(() =>
    supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: identityToken,
      nonce: rawNonce,
    }),
  );
  if (error) throw error;

  const fullName = credential.fullName
    ? AppleAuthentication.formatFullName(credential.fullName).trim()
    : '';
  if (fullName || credential.email) {
    await supabase.auth.updateUser({
      data: {
        ...(fullName ? { full_name: fullName } : {}),
        ...(credential.fullName?.givenName ? { given_name: credential.fullName.givenName } : {}),
        ...(credential.fullName?.familyName ? { family_name: credential.fullName.familyName } : {}),
        ...(credential.email ? { email: credential.email } : {}),
        apple_user_id: credential.user,
      },
    });
  }
}

export async function signInWithGoogle(): Promise<void> {
  configureGoogleSignIn();

  if (Platform.OS === 'android') {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }

  const response = await withTransientRetry(() => GoogleSignin.signIn());
  const data = assertGoogleSuccess(response);
  const idToken = data.idToken;
  if (!idToken) {
    throw new Error('Google did not return an identity token.');
  }
  const accessToken = await getGoogleAccessToken();

  const { error } = await withTransientRetry(() =>
    supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
      ...(accessToken ? { access_token: accessToken } : {}),
    }),
  );
  if (error) throw error;
}

export const signInWithNativeGoogle = signInWithGoogle;

export async function signInWithOAuthProvider(provider: OAuthProvider): Promise<void> {
  const redirectTo = getAuthCallbackUrl();
  const { data, error } = await withTransientRetry(() =>
    supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        ...(provider === 'google'
          ? {
              queryParams: {
                prompt: 'select_account',
              },
            }
          : {}),
      },
    }),
  );
  if (error) throw error;
  if (!data.url) throw new Error('Auth provider did not return a URL');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') throw new Error('Sign in was cancelled');

  const callbackParams = getCallbackParams(result.url);
  const accessToken = callbackParams.get('access_token');
  const refreshToken = callbackParams.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (sessionError) throw sessionError;
    return;
  }

  const code = callbackParams.get('code');
  if (!code) throw new Error('Auth provider did not return an authorization code');

  const { error: exchangeError } = await withTransientRetry(() =>
    supabase.auth.exchangeCodeForSession(code),
  );
  if (exchangeError) throw exchangeError;
}

export async function signOutSupabase(): Promise<void> {
  await supabase.auth.signOut();
  try {
    await GoogleSignin.signOut();
  } catch {
    // Ignore Google native session cleanup failures.
  }
}
