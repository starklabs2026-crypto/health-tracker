import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { OtpInput } from 'react-native-otp-entry';

import { Button, Screen, Subtitle, Title } from '../../src/components/ui';
import { requestOtp, verifyOtp } from '../../src/lib/api/endpoints';
import { useAuthStore } from '../../src/lib/auth/authStore';
import { setTokens } from '../../src/lib/auth/tokenStorage';
import { currentPlatform, getDeviceId } from '../../src/lib/device';
import { colors, spacing } from '../../src/theme/tokens';

const RESEND_SECONDS = 30;

export default function Otp() {
  const { identifier } = useLocalSearchParams<{ identifier: string }>();
  const setUnlocked = useAuthStore((s) => s.setUnlocked);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  async function verify(value: string): Promise<void> {
    if (!identifier) return;
    setError(null);
    setLoading(true);
    try {
      const deviceId = await getDeviceId();
      const res = await verifyOtp({
        identifier,
        code: value,
        deviceId,
        platform: currentPlatform(),
      });
      await setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      setUnlocked(true);
      router.replace(res.isNewUser ? '/(auth)/onboarding/basics' : '/(tabs)/home');
    } catch {
      setError('Invalid or expired code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function resend(): Promise<void> {
    if (!identifier || countdown > 0) return;
    await requestOtp(identifier);
    setCountdown(RESEND_SECONDS);
  }

  return (
    <Screen>
      <Title>Enter code</Title>
      <Subtitle>We sent a 6-digit code to {identifier}.</Subtitle>

      <OtpInput
        numberOfDigits={6}
        onTextChange={setCode}
        onFilled={(value) => void verify(value)}
        focusColor={colors.primary}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={{ marginTop: spacing.lg }}>
        <Button label="Verify" onPress={() => void verify(code)} loading={loading} disabled={code.length !== 6} />
      </View>

      <Pressable onPress={() => void resend()} disabled={countdown > 0} style={{ marginTop: spacing.md }}>
        <Text style={[styles.resend, { color: countdown > 0 ? colors.textSecondary : colors.primary }]}>
          {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger, fontSize: 14, marginTop: spacing.md },
  resend: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
});
