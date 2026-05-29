import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import {
  GoogleSignin,
  isSuccessResponse,
  type SignInResponse,
} from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

import { supabase } from './client';
import { publicRuntimeConfig } from '../config';
import { getMe } from '../api/endpoints';

WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = 'apple' | 'google';

const PRODUCTION_AUTH_CALLBACK_URL = 'healthfolio://auth/callback';
let googleConfigured = false;

async function sha256Hex(value: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
}

function getAuthCallbackUrl(): string {
  return process.env.NODE_ENV === 'production'
    ? PRODUCTION_AUTH_CALLBACK_URL
    : Linking.createURL('/auth/callback');
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
  const { data, error } = await withTransientRetry(() => supabase.auth.signUp({ email, password }));
  if (error) throw error;
  return Boolean(data.session);
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
  const tokens = await GoogleSignin.getTokens();

  const { error } = await withTransientRetry(() =>
    supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
      access_token: tokens.accessToken,
    }),
  );
  if (error) throw error;
}

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

  const url = new URL(result.url);
  const code = url.searchParams.get('code');
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
