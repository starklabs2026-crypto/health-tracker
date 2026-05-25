import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { z } from 'zod';

import { Button, Screen, Subtitle, TextField, Title } from '../../src/components/ui';
import { requestOtp } from '../../src/lib/api/endpoints';

const emailSchema = z.string().email();
const phoneSchema = z.string().regex(/^\+?[0-9]{6,15}$/, 'Enter a valid phone number');

export default function Identifier() {
  const { mode } = useLocalSearchParams<{ mode: 'email' | 'phone' }>();
  const isEmail = mode !== 'phone';
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(): Promise<void> {
    const schema = isEmail ? emailSchema : phoneSchema;
    const parsed = schema.safeParse(value.trim());
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await requestOtp(parsed.data);
      router.push(`/(auth)/otp?identifier=${encodeURIComponent(parsed.data)}`);
    } catch {
      setError('Could not send a code. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Title>{isEmail ? 'Your email' : 'Your phone'}</Title>
      <Subtitle>We&apos;ll send you a 6-digit verification code.</Subtitle>
      <TextField
        label={isEmail ? 'Email address' : 'Phone number'}
        value={value}
        onChangeText={setValue}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={isEmail ? 'email-address' : 'phone-pad'}
        placeholder={isEmail ? 'you@example.com' : '+15550001'}
        errorText={error ?? undefined}
      />
      <Button label="Send code" onPress={() => void submit()} loading={loading} />
    </Screen>
  );
}
