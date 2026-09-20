import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import {
  AppScroll,
  Button,
  FamilyProfilesVisual,
  typography,
} from '../../../src/components/healthfolio';
import { spacing } from '../../../src/theme/tokens';

export default function FamilyLater() {
  function continueFlow(): void {
    router.replace('/documents/new');
  }

  return (
    <AppScroll contentStyle={styles.content}>
      <View style={styles.header}>
        <Text style={typography.eyebrow}>Reports first</Text>
        <Text style={[typography.h2, styles.heading]}>Profiles are created from reports.</Text>
      </View>
      <FamilyProfilesVisual />
      <Button label="Start uploading" onPress={continueFlow} />
    </AppScroll>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center' },
  header: { marginBottom: spacing.sm },
  heading: { marginTop: spacing.xs },
});
