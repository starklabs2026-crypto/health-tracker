import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import {
  BrandLockup,
  Button,
  CenteredScreen,
} from '../../src/components/healthfolio';
import { colors, spacing } from '../../src/theme/tokens';

export default function Welcome() {
  return (
    <CenteredScreen>
      <BrandLockup logoSize={54} textStyle={styles.brandText} />
      <Text style={styles.tagline}>Your reports, readings, and doctor-ready summary.</Text>
      <View style={styles.actions}>
        <Button
          label="I'm new"
          onPress={() => router.push('/(auth)/identifier?mode=signup')}
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
  tagline: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 21,
    marginTop: spacing.sm,
    maxWidth: 280,
    textAlign: 'center',
  },
  actions: { gap: spacing.sm, width: '100%', marginTop: spacing.lg },
  welcomeButton: { minHeight: 50 },
  welcomeButtonText: { fontSize: 15 },
});
