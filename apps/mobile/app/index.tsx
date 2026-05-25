import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { getTokens } from '../src/lib/auth/tokenStorage';
import { colors } from '../src/theme/tokens';

// Auth gate / splash. Decides where to send the user on launch:
//  - tokens present -> /lock (biometric unlock) -> tabs
//  - no tokens      -> /welcome (sign-up / sign-in)
export default function Index() {
  useEffect(() => {
    let active = true;
    void (async () => {
      const tokens = await getTokens();
      if (!active) return;
      router.replace(tokens ? '/lock' : '/welcome');
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}
