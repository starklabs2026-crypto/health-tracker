import { DocType, OcrStatus, type DocumentSummary } from '@medical-tracker/shared-types';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppScroll, Button, Card, EmptyState, Pill, Row, TopBar, typography } from '../../src/components/healthfolio';
import { listDocuments } from '../../src/lib/api/endpoints';
import { useProfileStore } from '../../src/lib/profile/profileStore';
import { colors, spacing } from '../../src/theme/tokens';

const DOC_TYPE_LABELS: Record<DocType, string> = {
  [DocType.LabReport]: 'Lab report',
  [DocType.Prescription]: 'Prescription',
  [DocType.ImagingReport]: 'Imaging report',
  [DocType.DischargeSummary]: 'Discharge summary',
  [DocType.VaccinationRecord]: 'Vaccination record',
  [DocType.Other]: 'Document',
};

const STATUS_LABELS: Record<OcrStatus, string> = {
  [OcrStatus.PendingUpload]: 'Pending',
  [OcrStatus.Queued]: 'Queued',
  [OcrStatus.Processing]: 'Processing',
  [OcrStatus.ReadyForReview]: 'Ready',
  [OcrStatus.Failed]: 'Failed',
};

function statusTone(status: OcrStatus): 'green' | 'amber' | 'blue' | 'red' | 'neutral' {
  if (status === OcrStatus.ReadyForReview) return 'amber';
  if (status === OcrStatus.Failed) return 'red';
  if (status === OcrStatus.Queued || status === OcrStatus.Processing) return 'blue';
  if (status === OcrStatus.PendingUpload) return 'neutral';
  return 'green';
}

export default function DocumentsScreen() {
  const { activeProfileId, activeProfileName } = useProfileStore();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['documents', activeProfileId],
    queryFn: () => listDocuments({ ...(activeProfileId ? { profileId: activeProfileId } : {}), limit: 100 }),
  });

  const docs = data?.items ?? [];

  return (
    <AppScroll
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
    >
      <TopBar
        eyebrow={activeProfileName ? `Selected profile: ${activeProfileName}` : 'Selected profile'}
        title="Documents"
        action={<Button label="Add" onPress={() => router.push('/documents/new')} style={styles.addButton} />}
      />

      <TextInput
        editable={false}
        placeholder="Search document, lab, or date"
        placeholderTextColor={colors.textSecondary}
        style={styles.search}
      />

      <View style={styles.chips}>
        <Pill label="All" tone="active" />
        <Pill label="Review" tone="amber" />
        <Pill label="Processing" tone="blue" />
        <Pill label="Reviewed" tone="green" />
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : docs.length === 0 ? (
        <Card>
          <EmptyState
            icon="file-plus"
            title="No documents yet"
            body="Upload a lab report to extract readings and organize your timeline."
            action={<Button label="Add document" onPress={() => router.push('/documents/new')} />}
          />
        </Card>
      ) : (
        <Card>
          {docs.map((doc) => (
            <DocumentRow key={doc.id} item={doc} />
          ))}
        </Card>
      )}

      {docs.length > 0 ? (
        <Card>
          <Text style={typography.h3}>Status mix</Text>
          <View style={styles.statusBar}>
            <View style={[styles.statusSegment, { flex: Math.max(1, docs.filter((d) => d.ocrStatus === OcrStatus.ReadyForReview).length), backgroundColor: colors.amber }]} />
            <View style={[styles.statusSegment, { flex: Math.max(1, docs.filter((d) => d.ocrStatus === OcrStatus.Processing || d.ocrStatus === OcrStatus.Queued).length), backgroundColor: colors.blue }]} />
            <View style={[styles.statusSegment, { flex: Math.max(1, docs.filter((d) => d.ocrStatus !== OcrStatus.ReadyForReview && d.ocrStatus !== OcrStatus.Failed).length), backgroundColor: colors.primary }]} />
            <View style={[styles.statusSegment, { flex: Math.max(1, docs.filter((d) => d.ocrStatus === OcrStatus.Failed).length), backgroundColor: colors.danger }]} />
          </View>
        </Card>
      ) : null}
    </AppScroll>
  );
}

function DocumentRow({ item }: { item: DocumentSummary }) {
  const status = item.ocrStatus as OcrStatus;
  return (
    <Row
      title={DOC_TYPE_LABELS[item.docType as DocType] ?? item.docType}
      subtitle={`${item.labName ?? 'Unknown source'}, ${new Date(item.sourceDate).toLocaleDateString()}`}
      right={<Pill label={STATUS_LABELS[status] ?? status} tone={statusTone(status)} />}
      onPress={() => router.push(`/documents/${item.id}`)}
    />
  );
}

const styles = StyleSheet.create({
  addButton: { width: 60, minHeight: 36, marginTop: 0 },
  search: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  statusBar: { height: 18, flexDirection: 'row', overflow: 'hidden', gap: 6, marginTop: spacing.md },
  statusSegment: { borderRadius: 9 },
});
