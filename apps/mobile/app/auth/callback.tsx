import { router, useGlobalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import { Button, TextField } from '../../src/components/ui';
import { useAuthStore } from '../../src/lib/auth/authStore';
import {
  RecoveryLinkExpiredError,
  completeAuthCallback,
  getAuthCallbackUrl,
  resetPasswordForEmail,
  updatePassword,
} from '../../src/lib/supabase/auth';
import {
  PASSWORD_RESET_RESEND_SECONDS,
  isPasswordResetRateLimited,
  passwordResetRemaining,
} from '../../src/lib/supabase/authRedirect';
import { colors, spacing } from '../../src/theme/tokens';

const emailSchema = z.string().email();
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');

export default function AuthCallback() {
  const setUnlocked = useAuthStore((s) => s.setUnlocked);
  const [phase, setPhase] = useState<'working' | 'set-password' | 'expired' | 'done'>('working');
  const [message, setMessage] = useState('Opening your HealthFolio link…');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [resetAvailableAt, setResetAvailableAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const linkedUrl = Linking.useURL();
  const routeParams = useGlobalSearchParams();
  const [initialUrl, setInitialUrl] = useState<string | null>(null);
  const remaining = passwordResetRemaining(resetAvailableAt, now);
  const routeCallbackUrl = callbackUrlFromRoute(routeParams);
  const callbackUrl = [linkedUrl, initialUrl, routeCallbackUrl].find(
    (url) => Boolean(url && /auth\/callback/i.test(url) && /[?#].*(code|token_hash|access_token|error)=/i.test(url)),
  );

  useEffect(() => {
    void Linking.getInitialURL().then((value) => setInitialUrl(value));
  }, []);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [remaining]);

  useEffect(() => {
    if (!callbackUrl || !/auth\/callback/i.test(callbackUrl)) return;
    if (!/[?#].*(code|token_hash|access_token|error)=/i.test(callbackUrl)) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await completeAuthCallback(callbackUrl);
        if (cancelled) return;
        if (result.isRecovery) {
          setPhase('set-password');
          setMessage('Choose a new password for your HealthFolio account.');
          return;
        }
        setUnlocked(true);
        setPhase('done');
        router.replace('/(tabs)/home');
      } catch (error) {
        if (cancelled) return;
        setPhase('expired');
        setMessage(
          error instanceof RecoveryLinkExpiredError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'This reset link is invalid or has expired.',
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [callbackUrl, setUnlocked]);

  async function savePassword(): Promise<void> {
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? 'Enter a valid password');
      return;
    }
    if (password !== confirmation) {
      setMessage('The two passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
      setUnlocked(true);
      router.replace('/(tabs)/home');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The password could not be updated.');
    } finally {
      setBusy(false);
    }
  }

  async function sendNewLink(): Promise<void> {
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? 'Enter a valid email');
      return;
    }
    if (remaining > 0) {
      setMessage(`You can request another reset link in ${remaining} seconds.`);
      return;
    }
    setBusy(true);
    try {
      await resetPasswordForEmail(parsed.data);
      setResetAvailableAt(Date.now() + PASSWORD_RESET_RESEND_SECONDS * 1000);
      setMessage('Check your email for the HealthFolio password reset link.');
    } catch (error) {
      if (isPasswordResetRateLimited(error)) {
        setResetAvailableAt(Date.now() + PASSWORD_RESET_RESEND_SECONDS * 1000);
        setMessage(`You can request another reset link in ${PASSWORD_RESET_RESEND_SECONDS} seconds.`);
        return;
      }
      setMessage(error instanceof Error ? error.message : 'A new link could not be sent.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{phase === 'set-password' ? 'Set new password' : 'Password reset'}</Text>
      <Text style={styles.message}>{message}</Text>
      {phase === 'set-password' ? (
        <>
          <TextField label="New password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
          <TextField
            label="Confirm password"
            value={confirmation}
            onChangeText={setConfirmation}
            secureTextEntry
            autoCapitalize="none"
          />
          <Button label="Update password" onPress={() => void savePassword()} loading={busy} />
        </>
      ) : null}
      {phase === 'expired' ? (
        <>
          <TextField
            label="HealthFolio email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Button
            label={remaining > 0 ? `Send a new link (${remaining}s)` : 'Send a new link'}
            onPress={() => void sendNewLink()}
            disabled={remaining > 0 || email.trim().length === 0}
            loading={busy}
          />
        </>
      ) : null}
    </View>
  );
}

function callbackUrlFromRoute(params: object): string | null {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === 'string' && first.length > 0) search.set(key, first);
  }
  const query = search.toString();
  return query ? `${getAuthCallbackUrl()}?${query}` : null;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: spacing.sm,
  },
  title: { color: colors.textPrimary, fontSize: 28, fontWeight: '700' },
  message: { color: colors.textSecondary, fontSize: 16, lineHeight: 22, marginBottom: spacing.sm },
});
