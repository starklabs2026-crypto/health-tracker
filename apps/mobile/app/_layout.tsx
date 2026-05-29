import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuthStore } from '../src/lib/auth/authStore';
import { queryClient } from '../src/lib/query';
import { ensureUploadQueueProcessing } from '../src/lib/uploads/uploadQueueStore';

export default function RootLayout() {
  const isStale = useAuthStore((s) => s.isStale);
  const setUnlocked = useAuthStore((s) => s.setUnlocked);
  const touch = useAuthStore((s) => s.touch);

  // Idle re-lock (playbook §1.2.3): re-prompt biometric if backgrounded > 5 min.
  useEffect(() => {
    ensureUploadQueueProcessing();

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && isStale()) {
        setUnlocked(false);
      } else if (state === 'active') {
        touch();
      }
      if (state === 'active') {
        ensureUploadQueueProcessing();
      }
    });
    return () => sub.remove();
  }, [isStale, setUnlocked, touch]);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
