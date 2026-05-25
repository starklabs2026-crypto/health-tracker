import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { DevicePlatform } from '@medical-tracker/shared-types';

const DEVICE_ID_KEY = 'mt.deviceId';

/** Stable per-install device id (persisted in secure storage). */
export async function getDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  return id;
}

export function currentPlatform(): DevicePlatform {
  if (Platform.OS === 'ios') return 'ios' as DevicePlatform;
  if (Platform.OS === 'android') return 'android' as DevicePlatform;
  return 'web' as DevicePlatform;
}
