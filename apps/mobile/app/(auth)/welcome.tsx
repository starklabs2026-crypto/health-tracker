import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Screen, Subtitle, Title } from '../../src/components/ui';

export default function Welcome() {
  return (
    <Screen>
      <Title>Medical Tracker</Title>
      <Subtitle>Your medical records, unified and always with you.</Subtitle>
      <View>
        <Button
          label="Continue with Email"
          onPress={() => router.push('/(auth)/identifier?mode=email')}
        />
        <Button
          label="Continue with Phone"
          variant="secondary"
          onPress={() => router.push('/(auth)/identifier?mode=phone')}
        />
      </View>
    </Screen>
  );
}
