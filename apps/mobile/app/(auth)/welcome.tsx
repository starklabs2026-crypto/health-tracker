import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import {
  BrandLockup,
  Button,
  CenteredScreen,
  DocumentVisual,
  HeroCard,
  typography,
} from '../../src/components/healthfolio';
import { spacing } from '../../src/theme/tokens';

export default function Welcome() {
  return (
    <CenteredScreen>
      <BrandLockup logoSize={54} textStyle={styles.brandText} />
      <HeroCard tone="light" style={styles.introCard}>
        <Text style={typography.eyebrow}>Private health record</Text>
        <Text style={[typography.h1, styles.introTitle]}>
          Your reports, readings, and doctor-ready summary.
        </Text>
        <Text style={[typography.body, styles.introCopy]}>
          Organize health records without turning them into medical advice.
        </Text>
        <DocumentVisual />
      </HeroCard>
      <View style={styles.actions}>
        <Button
          label="I'm new"
          onPress={() => router.push('/(auth)/onboarding/basics?mode=signup')}
          style={styles.welcomeButton}
          textStyle={styles.welcomeButtonText}
        />
        <Button
          label="I have an account"
          variant="secondary"
          onPress={() => router.push('/(auth)/identifier?mode=signin')}
          style={styles.welcomeButton}
          textStyle={styles.welcomeButtonText}
        />
      </View>
    </CenteredScreen>
  );
}

const styles = StyleSheet.create({
  brandText: { fontSize: 26, lineHeight: 31 },
  introCard: { minHeight: 196, marginBottom: spacing.md },
  introTitle: { maxWidth: 268, marginTop: spacing.sm, fontSize: 28, lineHeight: 34 },
  introCopy: { maxWidth: 252, marginTop: spacing.sm, fontSize: 15, lineHeight: 21 },
  actions: { gap: spacing.sm },
  welcomeButton: { minHeight: 50 },
  welcomeButtonText: { fontSize: 15 },
});
