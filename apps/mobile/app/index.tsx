import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { CenteredScreen, LogoMark, typography } from '../src/components/healthfolio';
import { hasSupabaseSession } from '../src/lib/supabase/auth';
import { colors, spacing } from '../src/theme/tokens';

// Auth gate / splash. Decides where to send the user on launch:
//  - Supabase session -> /lock (biometric unlock) -> tabs
//  - no session       -> /welcome
export default function Index() {
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const hasSession = await hasSupabaseSession();
        if (!active) return;
        if (!hasSession) {
          router.replace('/welcome');
          return;
        }
        router.replace('/lock');
      } catch {
        if (!active) return;
        router.replace('/welcome');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <CenteredScreen>
      <View
        style={{
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LogoMark size={64} />
        <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: spacing.md }} />
        <Text style={[typography.bodySmall, { marginTop: spacing.sm }]}>Opening HealthFolio</Text>
      </View>
    </CenteredScreen>
  );
}
