import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { Button, Screen, Subtitle, Title } from '../src/components/ui';
import { useAuthStore } from '../src/lib/auth/authStore';
import { signOut } from '../src/lib/auth/session';
import { hasAppProfile } from '../src/lib/supabase/auth';

// Biometric unlock gate (playbook §1.2.3). Runs on launch (when tokens exist)
// and after an idle re-lock. Falls through automatically if the device has no
// biometric hardware/enrollment.
export default function LockScreen() {
  const setUnlocked = useAuthStore((s) => s.setUnlocked);
  const [failed, setFailed] = useState(false);

  const authenticate = useCallback(async () => {
    setFailed(false);
    const routeAfterUnlock = (await hasAppProfile()) ? '/(tabs)/home' : '/(auth)/onboarding/basics';
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
    <Screen>
      <Title>Locked</Title>
      <Subtitle>
        {failed ? 'Authentication failed. Try again or sign out.' : 'Unlocking with biometrics…'}
      </Subtitle>
      {failed ? (
        <>
          <Button label="Try again" onPress={() => void authenticate()} />
          <Button label="Sign out" variant="secondary" onPress={() => void logout()} />
        </>
      ) : null}
    </Screen>
  );
}
