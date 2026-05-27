import { Feather } from '@expo/vector-icons';
import { DocType, OcrStatus, RangeFlag, type ParameterReading } from '@medical-tracker/shared-types';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, type ComponentProps } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import {
  AppScroll,
  Button,
  Card,
  EmptyState,
  HeroCard,
  LoadingScreen,
  MetricTile,
  Pill,
  ProfilePill,
  Row,
  TopBar,
  typography,
} from '../../src/components/healthfolio';
import { getMe, listDocuments, listReadings } from '../../src/lib/api/endpoints';
import { colors, spacing } from '../../src/theme/tokens';

const DOC_TYPE_LABELS: Record<DocType, string> = {
  [DocType.LabReport]: 'Lab report',
  [DocType.Prescription]: 'Prescription',
  [DocType.ImagingReport]: 'Imaging report',
  [DocType.DischargeSummary]: 'Discharge summary',
  [DocType.VaccinationRecord]: 'Vaccination record',
  [DocType.Other]: 'Document',
};

type FeatherName = ComponentProps<typeof Feather>['name'];

function pickAbnormal(readings: ParameterReading[]): ParameterReading[] {
  return readings
    .filter((r) => r.rangeFlag !== RangeFlag.Normal && r.rangeFlag !== RangeFlag.Unknown)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
    .slice(0, 4);
}

function statusTone(status: OcrStatus): 'green' | 'amber' | 'blue' | 'red' | 'neutral' {
  if (status === OcrStatus.ReadyForReview) return 'amber';
  if (status === OcrStatus.Failed) return 'red';
  if (status === OcrStatus.Queued || status === OcrStatus.Processing) return 'blue';
  return 'green';
}

export default function HomeScreen() {
  const { data: me, isLoading: loadingMe } = useQuery({ queryKey: ['me'], queryFn: getMe });
  const {
    data: readings,
    isLoading: loadingReadings,
    refetch: refetchReadings,
    isRefetching,
  } = useQuery({
    queryKey: ['readings'],
    queryFn: () => listReadings({ limit: 200 }),
  });
  const { data: docs, refetch: refetchDocs } = useQuery({
    queryKey: ['documents'],
    queryFn: () => listDocuments({ limit: 20 }),
  });

  const onRefresh = useCallback(() => {
    void refetchReadings();
    void refetchDocs();
  }, [refetchDocs, refetchReadings]);

  if (loadingMe || loadingReadings) {
    return <LoadingScreen />;
  }

  const name = me?.user.name?.trim();
  const firstName = name ? name.split(' ')[0] : 'there';
  const allReadings = readings?.items ?? [];
  const allDocs = docs?.items ?? [];
  const abnormal = pickAbnormal(allReadings);
  const readyForReview = allDocs.filter((d) => d.ocrStatus === OcrStatus.ReadyForReview);
  const recentDocs = allDocs.slice(0, 3);

  return (
    <AppScroll
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
    >
      <TopBar eyebrow="Good morning" title={firstName} action={<ProfilePill name="Me" />} />

      <HeroCard>
        <Text style={[typography.eyebrow, styles.heroEyebrow]}>Primary action</Text>
        <Text style={[typography.h3, styles.heroText]}>Add a medical report</Text>
        <Text style={[typography.bodySmall, styles.heroCopy]}>
          Upload a report to extract readings for review.
        </Text>
        <Button
          label="Add"
          onPress={() => router.push('/documents/new')}
          style={styles.heroButton}
        />
      </HeroCard>

      <View style={styles.metricRow}>
        <MetricTile value={allReadings.length} label="Readings" />
        <MetricTile value={readyForReview.length} label="Review" tone="amber" />
        <MetricTile value={allDocs.length} label="Docs" tone="green" />
      </View>

      {readyForReview.length > 0 ? (
        <Card style={styles.attentionCard}>
          <Row
            title={`${readyForReview.length} document${readyForReview.length > 1 ? 's' : ''} need review`}
            subtitle="Confirm extracted values before they enter history."
            right={<Pill label="Review" tone="amber" />}
            onPress={() => router.push('/(tabs)/documents')}
          />
        </Card>
      ) : null}

      <Card>
        <View style={styles.sectionHeader}>
          <Text style={typography.h3}>Today</Text>
          <Pill label="View all" tone="active" />
        </View>
        {recentDocs.length > 0 ? (
          recentDocs.map((doc) => (
            <Row
              key={doc.id}
              title={DOC_TYPE_LABELS[doc.docType as DocType] ?? 'Document'}
              subtitle={`${doc.labName ?? 'Unknown source'}, ${new Date(doc.sourceDate).toLocaleDateString()}`}
              right={<Pill label={doc.ocrStatus === OcrStatus.ReadyForReview ? 'Ready' : doc.ocrStatus} tone={statusTone(doc.ocrStatus as OcrStatus)} />}
              onPress={() => router.push(`/documents/${doc.id}`)}
            />
          ))
        ) : (
          <EmptyState
            icon="file-plus"
            title="No recent documents"
            body="Upload a lab report to start building your health timeline."
          />
        )}
      </Card>

      {abnormal.length > 0 ? (
        <Card>
          <Text style={typography.h3}>Attention needed</Text>
          {abnormal.map((reading) => (
            <Row
              key={reading.id}
              title={reading.parameterId.replace(/-/g, ' ')}
              subtitle={new Date(reading.recordedAt).toLocaleDateString()}
              right={<Pill label={reading.rangeFlag} tone={reading.rangeFlag === RangeFlag.Critical ? 'red' : 'amber'} />}
              onPress={() => router.push(`/readings/${reading.parameterId}`)}
            />
          ))}
        </Card>
      ) : null}

      <View style={styles.quickGrid}>
        <QuickAction label="Add report" icon="plus-circle" onPress={() => router.push('/documents/new')} />
        <QuickAction label="Readings" icon="activity" onPress={() => router.push('/(tabs)/readings')} />
        <QuickAction label="Share" icon="share-2" onPress={() => router.push('/shares')} />
        <QuickAction label="Family" icon="users" onPress={() => router.push('/(tabs)/family')} />
      </View>

      {allDocs.length === 0 ? (
        <Card style={styles.setupCard}>
          <Text style={typography.h3}>Start with one report</Text>
          <Text style={[typography.body, { marginTop: spacing.xs }]}>
            HealthFolio becomes useful after the first lab report is uploaded and reviewed.
          </Text>
          <Button label="Upload document" onPress={() => router.push('/documents/new')} />
        </Card>
      ) : null}
    </AppScroll>
  );
}

function QuickAction({ label, icon, onPress }: { label: string; icon: FeatherName; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.quickCard}>
      <View style={styles.quickIcon}>
        <Feather name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heroEyebrow: { color: 'rgba(255,255,255,0.72)' },
  heroText: { color: '#FFFFFF', marginTop: spacing.xs },
  heroCopy: { color: 'rgba(255,255,255,0.82)', marginTop: spacing.xs, maxWidth: 210 },
  heroButton: {
    alignSelf: 'flex-start',
    minWidth: 108,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  metricRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: 10 },
  attentionCard: { backgroundColor: colors.amberBg, borderColor: '#EFD17E' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quickCard: {
    width: '48%',
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  quickIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softSurface,
  },
  quickLabel: { flex: 1, color: colors.textPrimary, fontSize: 13, fontWeight: '800' },
  setupCard: { marginTop: spacing.sm },
});
