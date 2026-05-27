import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { z } from 'zod';

import {
  AppleMark,
  AppScroll,
  Button,
  Card,
  GoogleMark,
  ProgressBar,
  typography,
} from '../../src/components/healthfolio';
import { TextField } from '../../src/components/ui';
import { updateMe } from '../../src/lib/api/endpoints';
import { useAuthStore } from '../../src/lib/auth/authStore';
import { useOnboardingDraftStore } from '../../src/lib/onboarding/draftStore';
import {
  hasAppProfile,
  signInWithApple,
  signInWithNativeGoogle,
  signInWithPassword,
  signUpWithPassword,
} from '../../src/lib/supabase/auth';
import { colors, spacing } from '../../src/theme/tokens';

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
    for (const value of [candidate.message, candidate.error_description, candidate.error, candidate.code]) {
      if (typeof value === 'string' && value.trim()) return value;
    }
  }
  return '';
}

function authErrorMessage(error: unknown, provider: AuthProvider): string {
  const message = rawErrorMessage(error);
  if (/cancel/i.test(message)) return 'Sign-in was cancelled.';
  if (/invalid_credentials/i.test(message) || /Invalid login credentials/i.test(message)) {
    return 'No account matched that email and password.';
  }
  if (/invalid_audience/i.test(message)) {
    return 'Google sign-in is not fully configured yet. Please use email and password while we finish setup.';
  }
  if (/nonce/i.test(message)) return 'Apple sign-in could not be verified. Please try again.';
  if (/Apple sign-in/i.test(message) && provider !== 'apple') {
    return `Could not sign in with ${provider}. Please try again.`;
  }
  if (message.trim()) return provider === 'email' ? message : `Could not sign in with ${provider}. Please try again.`;
  return 'Could not sign in. Please try again.';
}

export default function Identifier() {
  const { mode } = useLocalSearchParams<{ mode: 'signup' | 'signin' }>();
  const isSignup = mode === 'signup';
  const setUnlocked = useAuthStore((s) => s.setUnlocked);
  const basicDetails = useOnboardingDraftStore((s) => s.basicDetails);
  const clearDraft = useOnboardingDraftStore((s) => s.clear);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<AuthProvider | null>(null);
  const authAttemptRef = useRef(0);
  const isLoading = loadingProvider !== null;

  async function runAuthAttempt(provider: AuthProvider, action: () => Promise<void>): Promise<void> {
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
    if (forceOnboarding && basicDetails) {
      await updateMe(basicDetails);
      clearDraft();
      router.replace('/(tabs)/home');
      return;
    }

    const hasProfile = await hasAppProfile();
    if (forceOnboarding || !hasProfile) {
      router.replace('/(auth)/onboarding/basics');
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
      await signInWithNativeGoogle();
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
    <AppScroll contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      {isSignup ? (
        <>
          <Text style={typography.eyebrow}>Step 3 of 3</Text>
          <ProgressBar value={1} />
        </>
      ) : null}
      <Card>
        <Text style={typography.h2}>{isSignup ? 'Create your secure account.' : 'Welcome back.'}</Text>
        <Text style={[typography.body, { marginTop: spacing.xs }]}>
          {isSignup
            ? 'Your profile is saved after authentication succeeds.'
            : 'Sign in to continue to your health records.'}
        </Text>
      </Card>
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
      {isSignup ? (
        <Card style={styles.privacyCard}>
          <Text style={styles.privacyTitle}>Sensitive information</Text>
          <Text style={typography.bodySmall}>Reports may contain private health data.</Text>
        </Card>
      ) : null}
    </AppScroll>
  );
}

const styles = StyleSheet.create({
  privacyCard: { backgroundColor: colors.amberBg, borderColor: '#EFD17E', marginTop: spacing.md },
  privacyTitle: { color: '#744A09', fontSize: 13, fontWeight: '800', marginBottom: 2 },
});
