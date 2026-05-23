import type { HealthResponse } from '@medical-tracker/shared-types';
import axios from 'axios';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

// EXPO_PUBLIC_* vars are inlined at build time. On a physical phone via Expo Go,
// set this to the dev machine's LAN IP (not localhost) in apps/mobile/.env.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export default function HomeScreen() {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function pingApi(): Promise<void> {
    setLoading(true);
    setResult(null);
    try {
      const { data } = await axios.get<HealthResponse>(`${API_URL}/health`, { timeout: 5000 });
      setResult(JSON.stringify(data, null, 2));
    } catch {
      setResult(`Could not reach API at ${API_URL}.\nIs it running? (npm run dev)`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Medical Tracker</Text>
      <Text style={styles.subtitle}>MVP prototype — Phase 0</Text>

      <Pressable
        style={styles.button}
        onPress={() => void pingApi()}
        accessibilityRole="button"
        accessibilityLabel="Ping API health endpoint"
      >
        <Text style={styles.buttonText}>Ping API</Text>
      </Pressable>

      {loading ? <ActivityIndicator style={{ marginTop: 16 }} color="#1F4E79" /> : null}
      {result ? <Text style={styles.result}>{result}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F7F9FC',
  },
  title: { fontSize: 28, fontWeight: '700', color: '#1F4E79' },
  subtitle: { fontSize: 14, color: '#5C6B7A', marginTop: 4, marginBottom: 32 },
  button: {
    backgroundColor: '#1F4E79',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    minHeight: 44,
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  result: {
    marginTop: 24,
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#1A1A1A',
    textAlign: 'center',
  },
});
