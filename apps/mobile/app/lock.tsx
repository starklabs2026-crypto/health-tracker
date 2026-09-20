import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button, CenteredScreen, LogoMark, typography } from '../src/components/healthfolio';
import { useAuthStore } from '../src/lib/auth/authStore';
import { signOut } from '../src/lib/auth/session';
import { hasAppProfile } from '../src/lib/supabase/auth';
import { colors, spacing } from '../src/theme/tokens';

// Biometric unlock gate (playbook §1.2.3). Runs on launch (when tokens exist)
// and after an idle re-lock. Falls through automatically if the device has no
// biometric hardware/enrollment.
export default function LockScreen() {
  const setUnlocked = useAuthStore((s) => s.setUnlocked);
  const [failed, setFailed] = useState(false);

  const authenticate = useCallback(async () => {
    setFailed(false);
    const routeAfterUnlock = (await hasAppProfile()) ? '/(tabs)/home' : '/(auth)/onboarding/health';
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !enrolled) {
      setUnlocked(true);
      router.replace(routeAfterUnlock);
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock HealthFolio',
    });
    if (result.success) {
      setUnlocked(true);
      router.replace(routeAfterUnlock);
    } else {
      setFailed(true);
    }
  }, [setUnlocked]);

  useEffect(() => {
    void authenticate();
  }, [authenticate]);

  async function logout(): Promise<void> {
    await signOut();
    router.replace('/welcome');
  }

  return (
    <CenteredScreen>
      <View style={styles.stack}>
        <LogoMark size={58} />
        <View style={styles.copy}>
          <Text style={[typography.h2, styles.title]}>
            {failed ? 'Unlock failed' : 'Unlock HealthFolio'}
          </Text>
          <Text style={styles.subtitle}>
            {failed ? 'Try again or sign out.' : 'Use Face ID or Touch ID to continue.'}
          </Text>
        </View>
        {!failed ? <ActivityIndicator color={colors.primary} /> : null}
      </View>
      {failed ? (
        <View style={styles.actions}>
          <Button label="Try again" onPress={() => void authenticate()} />
          <Button label="Sign out" variant="secondary" onPress={() => void logout()} />
        </View>
      ) : null}
    </CenteredScreen>
  );
}

const styles = StyleSheet.create({
  stack: { alignItems: 'center', gap: spacing.md },
  copy: { alignItems: 'center', maxWidth: 310 },
  title: { textAlign: 'center' },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  actions: { gap: spacing.sm, marginTop: spacing.lg, width: '100%' },
});
