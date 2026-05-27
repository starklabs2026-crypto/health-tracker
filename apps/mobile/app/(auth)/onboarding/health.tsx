import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import {
  AppScroll,
  Button,
  FamilyProfilesVisual,
  ProgressBar,
  typography,
} from '../../../src/components/healthfolio';
import { spacing } from '../../../src/theme/tokens';

export default function FamilyLater() {
  const { mode } = useLocalSearchParams<{ mode?: 'signup' }>();

  function continueFlow(): void {
    if (mode === 'signup') {
      router.push('/(auth)/identifier?mode=signup');
      return;
    }
    router.replace('/(tabs)/home');
  }

  return (
    <AppScroll contentStyle={styles.content}>
      <Text style={typography.eyebrow}>Step 2 of 3</Text>
      <ProgressBar value={0.67} />

      <View style={styles.header}>
        <Text style={typography.eyebrow}>Family profiles</Text>
        <Text style={[typography.h2, styles.heading]}>Keep every record in the right place.</Text>
        <Text style={[typography.body, styles.copy]}>
          Add a separate profile for a loved one whenever you manage their reports too.
        </Text>
      </View>
      <FamilyProfilesVisual />
      <Button label="Continue" onPress={continueFlow} />
    </AppScroll>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center' },
  header: { marginBottom: spacing.sm },
  heading: { marginTop: spacing.xs },
  copy: { marginTop: spacing.sm, maxWidth: 286 },
});
