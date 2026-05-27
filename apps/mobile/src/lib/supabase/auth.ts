import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

import { supabase } from './client';
import { getMe } from '../api/endpoints';

WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = 'apple';

const PRODUCTION_AUTH_CALLBACK_URL = 'healthfolio://auth/callback';
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
let googleConfigured = false;

async function sha256Hex(value: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
}

function getAuthCallbackUrl(): string {
  return process.env.NODE_ENV === 'production'
    ? PRODUCTION_AUTH_CALLBACK_URL
    : Linking.createURL('/auth/callback');
}

export async function hasSupabaseSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}

export async function hasAppProfile(): Promise<boolean> {
  try {
    const me = await getMe();
    return Boolean(me.user.name?.trim() && me.user.dob);
  } catch {
    return false;
  }
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUpWithPassword(email: string, password: string): Promise<boolean> {
  const { data, error } = await supabase.auth.signUp({ email, password });
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
  if (!credential.identityToken) {
    throw new Error('Apple did not return an identity token.');
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
    ...(credential.authorizationCode ? { access_token: credential.authorizationCode } : {}),
  });
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

function configureNativeGoogle(): void {
  if (googleConfigured) return;

  if (Platform.OS === 'ios' && !GOOGLE_IOS_CLIENT_ID) {
    throw new Error('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is required for Google sign-in.');
  }
  if (!GOOGLE_WEB_CLIENT_ID) {
    throw new Error('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is required for Google sign-in.');
  }
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    throw new Error('Native Google sign-in is only available on iOS and Android.');
  }

  GoogleSignin.configure({
    scopes: ['openid', 'email', 'profile'],
    webClientId: GOOGLE_WEB_CLIENT_ID,
    ...(Platform.OS === 'ios' && GOOGLE_IOS_CLIENT_ID ? { iosClientId: GOOGLE_IOS_CLIENT_ID } : {}),
  });
  googleConfigured = true;
}

export async function signInWithNativeGoogle(): Promise<void> {
  configureNativeGoogle();

  if (Platform.OS === 'android') {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }

  const result = await GoogleSignin.signIn();
  if (result.type !== 'success') {
    throw new Error('Google sign-in was cancelled.');
  }

  const { idToken, user } = result.data;
  if (!idToken) {
    throw new Error('Google did not return an identity token.');
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });
  if (error) throw error;

  await supabase.auth.updateUser({
    data: {
      google_user_id: user.id,
      ...(user.name ? { full_name: user.name } : {}),
      ...(user.givenName ? { given_name: user.givenName } : {}),
      ...(user.familyName ? { family_name: user.familyName } : {}),
      ...(user.photo ? { avatar_url: user.photo } : {}),
    },
  });
}

export async function signInWithOAuthProvider(provider: OAuthProvider): Promise<void> {
  const redirectTo = getAuthCallbackUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error('Auth provider did not return a URL');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') throw new Error('Sign in was cancelled');

  const url = new URL(result.url);
  const code = url.searchParams.get('code');
  if (!code) throw new Error('Auth provider did not return an authorization code');

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
}
