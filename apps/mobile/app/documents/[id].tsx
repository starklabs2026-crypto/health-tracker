import {
  DocType,
  OcrStatus,
  RangeFlag,
  ReadingStatus,
  type DocumentDetail,
  type ParameterReading,
} from '@medical-tracker/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';

import {
  AppScroll,
  Button,
  Card,
  LoadingScreen,
  Pill,
  Row,
  TopBar,
  typography,
} from '../../src/components/healthfolio';
import { deleteDocument, getDocument, patchReading } from '../../src/lib/api/endpoints';
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
  [OcrStatus.PendingUpload]: 'Pending upload',
  [OcrStatus.Queued]: 'Queued',
  [OcrStatus.Processing]: 'Processing',
  [OcrStatus.ReadyForReview]: 'Ready for review',
  [OcrStatus.Failed]: 'Failed',
};

function statusTone(status: OcrStatus): 'green' | 'amber' | 'blue' | 'red' | 'neutral' {
  if (status === OcrStatus.ReadyForReview) return 'amber';
  if (status === OcrStatus.Failed) return 'red';
  if (status === OcrStatus.Queued || status === OcrStatus.Processing) return 'blue';
  return 'green';
}

function flagTone(flag: RangeFlag): 'green' | 'amber' | 'red' | 'neutral' {
  if (flag === RangeFlag.Normal) return 'green';
  if (flag === RangeFlag.Critical) return 'red';
  if (flag === RangeFlag.Unknown) return 'neutral';
  return 'amber';
}

function isPolling(status: OcrStatus): boolean {
  return status === OcrStatus.Queued || status === OcrStatus.Processing;
}

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<DocumentDetail>({
    queryKey: ['document', id],
    queryFn: () => getDocument(id),
    refetchInterval: (query) => {
      const status = query.state.data?.document.ocrStatus as OcrStatus | undefined;
      return status && isPolling(status) ? 3000 : false;
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (readings: ParameterReading[]) => {
      await Promise.all(
        readings.map((reading) =>
          patchReading(reading.id, { status: ReadingStatus.Confirmed, isUserVerified: true }),
        ),
      );
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['document', id] });
      await qc.invalidateQueries({ queryKey: ['readings'] });
      await qc.invalidateQueries({ queryKey: ['trend'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteDocument(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['documents'] });
      router.back();
    },
  });

  function confirmDelete(): void {
    Alert.alert('Delete document', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
    ]);
  }

  if (isLoading || !data) return <LoadingScreen />;

  const { document: doc, readings } = data;
  const status = doc.ocrStatus as OcrStatus;
  const pendingReadings = readings.filter((reading) => reading.status !== ReadingStatus.Confirmed);

  return (
    <AppScroll>
      <TopBar
        eyebrow="Document"
        title={DOC_TYPE_LABELS[doc.docType as DocType] ?? doc.docType}
        action={<Pill label={STATUS_LABELS[status] ?? status} tone={statusTone(status)} />}
      />

      <Card>
        <Row
          title={doc.labName ?? 'Unknown source'}
          subtitle={`Source date: ${new Date(doc.sourceDate).toLocaleDateString()}`}
        />
        {doc.orderingPhysician ? (
          <Row title="Ordering doctor" subtitle={doc.orderingPhysician} />
        ) : null}
        {doc.notes ? <Row title="Notes" subtitle={doc.notes} /> : null}
      </Card>

      <Card>
        <Text style={typography.h3}>Document review</Text>
        <PipelineStep number="1" title="Uploaded" subtitle="Document received." done />
        <PipelineStep
          number="2"
          title={isPolling(status) ? 'Reading report' : 'Read complete'}
          subtitle={
            isPolling(status)
              ? 'Your document is being reviewed.'
              : 'Document status has been updated.'
          }
          done={status !== OcrStatus.PendingUpload}
        />
        <PipelineStep
          number="3"
          title="Review required"
          subtitle="Confirm extracted values before saving."
          done={status === OcrStatus.ReadyForReview}
          pending={status !== OcrStatus.ReadyForReview}
        />
      </Card>

      {status === OcrStatus.ReadyForReview && readings.length > 0 ? (
        <Card>
          <View style={styles.reviewHeader}>
            <View>
              <Text style={typography.h3}>Review readings</Text>
              <Text style={typography.bodySmall}>
                Please check these values against your report.
              </Text>
            </View>
            <Pill label={`${readings.length} values`} tone="amber" />
          </View>
          {readings.map((reading) => (
            <ReadingRow key={reading.id} reading={reading} />
          ))}
          {pendingReadings.length > 0 ? (
            <View style={styles.actions}>
              <Button
                label="Confirm all"
                onPress={() => confirmMutation.mutate(pendingReadings)}
                loading={confirmMutation.isPending}
              />
            </View>
          ) : (
            <Pill label="Reviewed" tone="green" />
          )}
        </Card>
      ) : null}

      {isPolling(status) ? (
        <Card>
          <Text style={typography.h3}>Extracting readings...</Text>
          <Text style={[typography.body, { marginTop: spacing.xs }]}>
            This screen refreshes automatically every few seconds.
          </Text>
        </Card>
      ) : null}

      {status === OcrStatus.Failed ? (
        <Card style={styles.failedCard}>
          <Text style={styles.failedTitle}>We could not extract readings from this document.</Text>
          <Text style={typography.bodySmall}>
            Try re-uploading a clearer image or add readings manually.
          </Text>
        </Card>
      ) : null}

      <Button
        label="Delete document"
        variant="danger"
        loading={deleteMutation.isPending}
        onPress={confirmDelete}
      />
    </AppScroll>
  );
}

function PipelineStep({
  number,
  title,
  subtitle,
  done,
  pending,
}: {
  number: string;
  title: string;
  subtitle: string;
  done?: boolean;
  pending?: boolean;
}) {
  return (
    <View style={styles.pipelineStep}>
      <View style={[styles.stepDot, pending && styles.stepDotPending]}>
        <Text style={[styles.stepDotText, pending && styles.stepDotTextPending]}>{number}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepSubtitle}>{subtitle}</Text>
      </View>
      {done ? <Pill label="Done" tone="green" /> : null}
    </View>
  );
}

function ReadingRow({ reading }: { reading: ParameterReading }) {
  const flag = reading.rangeFlag as RangeFlag;
  return (
    <Row
      title={reading.parameterId.replace(/-/g, ' ')}
      subtitle={reading.isUserVerified ? 'Reviewed' : 'Needs review'}
      right={
        <View style={styles.readingRight}>
          <Text style={styles.readingValue}>
            {reading.value} {reading.unit}
          </Text>
          <Pill label={flag} tone={flagTone(flag)} />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  pipelineStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  stepDotPending: { backgroundColor: colors.mutedBorder },
  stepDotText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  stepDotTextPending: { color: colors.textSecondary },
  stepTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '800' },
  stepSubtitle: { color: colors.textSecondary, fontSize: 12, lineHeight: 16, marginTop: 2 },
  readingRight: { alignItems: 'flex-end', gap: 4 },
  readingValue: { color: colors.textPrimary, fontSize: 13, fontWeight: '800' },
  actions: { marginTop: spacing.sm },
  failedCard: { backgroundColor: colors.redBg, borderColor: '#F0B8B3' },
  failedTitle: { color: colors.danger, fontSize: 15, fontWeight: '800', marginBottom: spacing.xs },
});
