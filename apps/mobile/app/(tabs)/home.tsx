import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getMe } from '../../src/lib/api/endpoints';
import { colors, radius, spacing } from '../../src/theme/tokens';

export default function Home() {
  const { data, isLoading } = useQuery({ queryKey: ['me'], queryFn: getMe });

  const name = data?.user.name?.trim();
  const greeting = name ? `Welcome, ${name}` : 'Welcome';

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      {isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <>
          <Text style={styles.greeting}>{greeting}</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No documents yet</Text>
            <Text style={styles.cardBody}>
              Upload a document to start tracking your health. Capture and OCR arrive next (Phase 2).
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg },
  greeting: { fontSize: 22, fontWeight: '700', color: colors.primary, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.xs },
  cardBody: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
});
