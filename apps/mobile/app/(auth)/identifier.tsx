import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import {
  AppleMark,
  AppScroll,
  BrandLockup,
  Button,
  GoogleMark,
} from '../../src/components/healthfolio';
import { TextField } from '../../src/components/ui';
import { useAuthStore } from '../../src/lib/auth/authStore';
import {
  signInWithApple,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
} from '../../src/lib/supabase/auth';
import { colors } from '../../src/theme/tokens';

const emailSchema = z.string().email();
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');
type AuthProvider = 'apple' | 'email' | 'google';

function rawErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const candidate = error as {
      code?: unknown;
      error?: unknown;
      error_description?: unknown;
      message?: unknown;
    };
    for (const value of [
      candidate.message,
      candidate.error_description,
      candidate.error,
      candidate.code,
    ]) {
      if (typeof value === 'string' && value.trim()) return value;
    }
  }
  return '';
}

function authErrorMessage(error: unknown, provider: AuthProvider): string {
  const message = rawErrorMessage(error);
  if (/cancel/i.test(message)) return 'Sign-in was cancelled.';
  if (/already has a HealthFolio account/i.test(message)) return message;
  if (/invalid_credentials/i.test(message) || /Invalid login credentials/i.test(message)) {
    return 'No account matched that email and password.';
  }
  if (/invalid_client|oauth client was not found/i.test(message)) {
    return provider === 'google'
      ? 'Google sign-in is misconfigured right now. The Google OAuth client needs to be repaired in Google Cloud and Supabase.'
      : 'This sign-in provider is not fully configured yet. Please try again.';
  }
  if (/invalid_audience|provider is not enabled|unsupported provider/i.test(message)) {
    return provider === 'google'
      ? `Google sign-in is not fully configured yet. ${message}`
      : 'This sign-in provider is not fully configured yet. Please try again.';
  }
  if (/redirect.*not.*allowed|redirect_to|not allowed/i.test(message)) {
    return provider === 'google'
      ? `Google sign-in redirect is not configured in Supabase. ${message}`
      : 'This sign-in redirect is not configured yet. Please try again.';
  }
  if (/nonce/i.test(message)) {
    return provider === 'google'
      ? `Google sign-in token could not be verified. ${message}`
      : 'Apple sign-in could not be verified. Please try again.';
  }
  if (/network request failed|failed to fetch|network error|timeout|timed out/i.test(message)) {
    return 'The network request failed. Please try again.';
  }
  if (/Apple sign-in/i.test(message) && provider !== 'apple') {
    return `Could not sign in with ${provider}. Please try again.`;
  }
  if (message.trim())
    return provider === 'email' ? message : `Could not sign in with ${provider}. ${message}`;
  return 'Could not sign in. Please try again.';
}

export default function Identifier() {
  const { mode } = useLocalSearchParams<{ mode: 'signup' | 'signin' }>();
  const isSignup = mode === 'signup';
  const setUnlocked = useAuthStore((s) => s.setUnlocked);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<AuthProvider | null>(null);
  const authAttemptRef = useRef(0);
  const isLoading = loadingProvider !== null;

  async function runAuthAttempt(
    provider: AuthProvider,
    action: () => Promise<void>,
  ): Promise<void> {
    const attempt = authAttemptRef.current + 1;
    authAttemptRef.current = attempt;
    setError(null);
    setLoadingProvider(provider);
    try {
      await action();
    } catch (err) {
      if (authAttemptRef.current === attempt) {
        setError(authErrorMessage(err, provider));
      }
    } finally {
      if (authAttemptRef.current === attempt) {
        setLoadingProvider(null);
      }
    }
  }

  async function routeAfterAuth(forceOnboarding = false): Promise<void> {
    setUnlocked(true);

    if (forceOnboarding) {
      router.replace('/(auth)/onboarding/health');
      return;
    }
    router.replace('/(tabs)/home');
  }

  async function submit(): Promise<void> {
    const parsedEmail = emailSchema.safeParse(email.trim());
    const parsedPassword = passwordSchema.safeParse(password);
    if (!parsedEmail.success) {
      authAttemptRef.current += 1;
      setError(parsedEmail.error.issues[0]?.message ?? 'Enter a valid email');
      return;
    }
    if (!parsedPassword.success) {
      authAttemptRef.current += 1;
      setError(parsedPassword.error.issues[0]?.message ?? 'Enter a valid password');
      return;
    }
    await runAuthAttempt('email', async () => {
      if (isSignup) {
        const hasSession = await signUpWithPassword(parsedEmail.data, parsedPassword.data);
        if (!hasSession) {
          setError('Check your email to finish creating your account.');
          return;
        }
        await routeAfterAuth(true);
      } else {
        await signInWithPassword(parsedEmail.data, parsedPassword.data);
        await routeAfterAuth(false);
      }
    });
  }

  async function submitGoogle(): Promise<void> {
    await runAuthAttempt('google', async () => {
      await signInWithGoogle();
      await routeAfterAuth(isSignup);
    });
  }

  async function submitApple(): Promise<void> {
    await runAuthAttempt('apple', async () => {
      await signInWithApple();
      await routeAfterAuth(isSignup);
    });
  }

  return (
    <AppScroll contentStyle={styles.content}>
      <View style={styles.header}>
        <BrandLockup logoSize={44} textStyle={styles.brandText} />
        <Text style={styles.caption}>
          {isSignup
            ? 'Start with email, Apple, or Google.'
            : 'Sign in with email, Apple, or Google.'}
        </Text>
      </View>

      <View style={styles.form}>
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder=""
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          placeholder=""
          errorText={error ?? undefined}
        />
      </View>

      <Button
        label="Continue"
        onPress={() => void submit()}
        loading={loadingProvider === 'email'}
        disabled={isLoading && loadingProvider !== 'email'}
      />
      <Button
        label="Continue with Apple"
        variant="dark"
        left={<AppleMark />}
        onPress={() => void submitApple()}
        loading={loadingProvider === 'apple'}
        disabled={isLoading && loadingProvider !== 'apple'}
      />
      <Button
        label="Continue with Google"
        variant="secondary"
        left={<GoogleMark />}
        onPress={() => void submitGoogle()}
        loading={loadingProvider === 'google'}
        disabled={isLoading && loadingProvider !== 'google'}
      />
    </AppScroll>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 22 },
  brandText: { fontSize: 24, lineHeight: 29 },
  caption: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: -6,
    textAlign: 'center',
  },
  form: { marginBottom: 4 },
});
