import { RangeFlag, type ParameterReading, OcrStatus } from '@medical-tracker/shared-types';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getMe, listDocuments, listReadings } from '../../src/lib/api/endpoints';
import { colors, radius, spacing } from '../../src/theme/tokens';

const FLAG_COLORS: Record<RangeFlag, string> = {
  [RangeFlag.Normal]: colors.rangeNormal,
  [RangeFlag.Low]: colors.rangeLow,
  [RangeFlag.High]: colors.rangeHigh,
  [RangeFlag.Critical]: colors.rangeCritical,
  [RangeFlag.Unknown]: colors.textSecondary,
};

function StatCard({
  label,
  value,
  color,
  onPress,
}: {
  label: string;
  value: string | number;
  color?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={styles.statCard}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${label}: ${value}`}
    >
      <Text style={[styles.statValue, color ? { color } : undefined]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );
}

/** Pick the 5 most-recent abnormal readings across all parameters. */
function pickAbnormal(readings: ParameterReading[]): ParameterReading[] {
  return readings
    .filter((r) => r.rangeFlag !== RangeFlag.Normal && r.rangeFlag !== RangeFlag.Unknown)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
    .slice(0, 5);
}

export default function HomeScreen() {
  const { data: me, isLoading: loadingMe } = useQuery({ queryKey: ['me'], queryFn: getMe });
  const { data: readings, isLoading: loadingReadings, refetch: refetchReadings, isRefetching } = useQuery({
    queryKey: ['readings'],
    queryFn: () => listReadings({ limit: 200 }),
  });
  const { data: docs, refetch: refetchDocs } = useQuery({
    queryKey: ['documents'],
    queryFn: () => listDocuments({}),
  });

  const onRefresh = useCallback(() => {
    void refetchReadings();
    void refetchDocs();
  }, [refetchReadings, refetchDocs]);

  const name = me?.user.name?.trim();
  const greeting = name ? `Welcome, ${name.split(' ')[0]}` : 'Welcome';

  const allReadings = readings?.items ?? [];
  const abnormal = pickAbnormal(allReadings);
  const pendingDocs = (docs?.items ?? []).filter(
    (d) => d.ocrStatus === OcrStatus.Queued || d.ocrStatus === OcrStatus.Processing,
  );
  const criticalCount = allReadings.filter((r) => r.rangeFlag === RangeFlag.Critical).length;

  if (loadingMe || loadingReadings) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
    >
      <Text style={styles.greeting} accessibilityRole="header">{greeting}</Text>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatCard
          label="Total readings"
          value={allReadings.length}
          onPress={() => router.push('/(tabs)/readings')}
        />
        <StatCard
          label="Abnormal"
          value={abnormal.length}
          color={abnormal.length > 0 ? colors.rangeHigh : colors.rangeNormal}
          onPress={() => router.push('/(tabs)/readings')}
        />
        <StatCard
          label="Critical"
          value={criticalCount}
          color={criticalCount > 0 ? colors.rangeCritical : colors.textSecondary}
          onPress={() => router.push('/(tabs)/readings')}
        />
      </View>

      {/* Pending docs banner */}
      {pendingDocs.length > 0 && (
        <Pressable
          style={styles.banner}
          onPress={() => router.push('/(tabs)/documents')}
          accessibilityRole="button"
          accessibilityLabel={`${pendingDocs.length} document${pendingDocs.length > 1 ? 's' : ''} being processed. Tap to view.`}
        >
          <Text style={styles.bannerText}>
            ⏳ {pendingDocs.length} document{pendingDocs.length > 1 ? 's' : ''} being processed…
          </Text>
        </Pressable>
      )}

      {/* Abnormal readings */}
      {abnormal.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Attention needed</Text>
          {abnormal.map((r) => {
            const flagColor = FLAG_COLORS[r.rangeFlag as RangeFlag] ?? colors.textSecondary;
            return (
              <Pressable
                key={r.id}
                style={styles.readingRow}
                onPress={() => router.push(`/readings/${r.parameterId}`)}
                accessibilityRole="button"
                accessibilityLabel={`${r.parameterId} ${r.value} ${r.unit} ${r.rangeFlag}`}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.readingParam}>{r.parameterId}</Text>
                  <Text style={styles.readingDate}>
                    {new Date(r.recordedAt).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={[styles.readingValue, { color: flagColor }]}>
                  {r.value} {r.unit}
                </Text>
                <Text style={[styles.readingFlag, { color: flagColor }]}>
                  {r.rangeFlag.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Quick actions */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quick actions</Text>
        <Pressable
          style={styles.actionRow}
          onPress={() => router.push('/(tabs)/documents')}
          accessibilityRole="button"
          accessibilityLabel="Upload a document"
        >
          <Text style={styles.actionIcon}>📄</Text>
          <Text style={styles.actionLabel}>Upload a document</Text>
          <Text style={styles.actionChevron}>›</Text>
        </Pressable>
        <Pressable
          style={styles.actionRow}
          onPress={() => router.push('/(tabs)/readings')}
          accessibilityRole="button"
          accessibilityLabel="View all readings"
        >
          <Text style={styles.actionIcon}>📊</Text>
          <Text style={styles.actionLabel}>View all readings</Text>
          <Text style={styles.actionChevron}>›</Text>
        </Pressable>
        <Pressable
          style={styles.actionRow}
          onPress={() => router.push('/shares')}
          accessibilityRole="button"
          accessibilityLabel="Share with doctor"
        >
          <Text style={styles.actionIcon}>🔗</Text>
          <Text style={styles.actionLabel}>Share with doctor</Text>
          <Text style={styles.actionChevron}>›</Text>
        </Pressable>
      </View>

      {allReadings.length === 0 && (
        <View style={[styles.card, { alignItems: 'center' }]}>
          <Text style={styles.emptyTitle}>No data yet</Text>
          <Text style={styles.emptyBody}>
            Upload a lab report from the Documents tab to get started.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  greeting: { fontSize: 22, fontWeight: '700', color: colors.primary, marginBottom: spacing.md },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
  },
  statValue: { fontSize: 24, fontWeight: '700', color: colors.textPrimary },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2, textAlign: 'center' },
  banner: {
    backgroundColor: '#FFF8E1',
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: '#F9A825',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  bannerText: { fontSize: 13, color: '#5C4033', fontWeight: '500' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  readingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  readingParam: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  readingDate: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  readingValue: { fontSize: 13, fontWeight: '600', marginRight: spacing.xs },
  readingFlag: { fontSize: 11, fontWeight: '700', minWidth: 50, textAlign: 'right' },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  actionIcon: { fontSize: 18, marginRight: spacing.sm },
  actionLabel: { flex: 1, fontSize: 14, color: colors.textPrimary },
  actionChevron: { fontSize: 18, color: colors.textSecondary },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.xs },
  emptyBody: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
