import { DocType, OcrStatus, type DocumentSummary } from '@medical-tracker/shared-types';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '../../src/components/ui';
import { ProfileSwitcher } from '../../src/components/ProfileSwitcher';
import { listDocuments } from '../../src/lib/api/endpoints';
import { useProfileStore } from '../../src/lib/profile/profileStore';
import { colors, radius, spacing } from '../../src/theme/tokens';

const DOC_TYPE_LABELS: Record<DocType, string> = {
  [DocType.LabReport]: 'Lab Report',
  [DocType.Prescription]: 'Prescription',
  [DocType.ImagingReport]: 'Imaging Report',
  [DocType.DischargeSummary]: 'Discharge Summary',
  [DocType.VaccinationRecord]: 'Vaccination Record',
  [DocType.Other]: 'Other',
};

const STATUS_LABELS: Record<OcrStatus, string> = {
  [OcrStatus.PendingUpload]: 'Pending',
  [OcrStatus.Queued]: 'Queued',
  [OcrStatus.Processing]: 'Processing…',
  [OcrStatus.ReadyForReview]: 'Ready',
  [OcrStatus.Failed]: 'Failed',
};

const STATUS_COLORS: Record<OcrStatus, string> = {
  [OcrStatus.PendingUpload]: colors.textSecondary,
  [OcrStatus.Queued]: '#4285F4',
  [OcrStatus.Processing]: '#F4B400',
  [OcrStatus.ReadyForReview]: colors.rangeNormal,
  [OcrStatus.Failed]: colors.danger,
};

function DocCard({ item }: { item: DocumentSummary }) {
  const statusColor = STATUS_COLORS[item.ocrStatus as OcrStatus] ?? colors.textSecondary;
  return (
    <Pressable
      style={styles.card}
      accessibilityRole="button"
      onPress={() => router.push(`/documents/${item.id}`)}
    >
      <View style={styles.cardRow}>
        <Text style={styles.cardTitle}>
          {DOC_TYPE_LABELS[item.docType as DocType] ?? item.docType}
        </Text>
        <Text style={[styles.badge, { color: statusColor }]}>
          {STATUS_LABELS[item.ocrStatus as OcrStatus] ?? item.ocrStatus}
        </Text>
      </View>
      <Text style={styles.cardMeta}>
        {new Date(item.sourceDate).toLocaleDateString()}
        {item.labName ? `  ·  ${item.labName}` : ''}
      </Text>
    </Pressable>
  );
}

export default function DocumentsScreen() {
  const { activeProfileId } = useProfileStore();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['documents', activeProfileId],
    queryFn: () =>
      listDocuments({ ...(activeProfileId ? { profileId: activeProfileId } : {}) }),
  });

  return (
    <View style={styles.container}>
      <ProfileSwitcher />
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <DocCard item={item} />}
        contentContainerStyle={styles.list}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
        ListHeaderComponent={
          <Button label="Add Document" onPress={() => router.push('/documents/new')} />
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No documents yet.</Text>
              <Text style={styles.emptySubtext}>
                Tap "Add Document" to capture and OCR a lab report.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  badge: { fontSize: 12, fontWeight: '600' },
  cardMeta: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs },
  empty: { alignItems: 'center', marginTop: spacing.xl },
  emptyText: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.xs },
  emptySubtext: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
});
