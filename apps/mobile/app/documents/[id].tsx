import {
  DocType,
  OcrStatus,
  RangeFlag,
  type DocumentDetail,
  type ParameterReading,
} from '@medical-tracker/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Image, Linking, Share, StyleSheet, Text, View } from 'react-native';

import {
  AppScroll,
  Card,
  Button,
  IconButton,
  LoadingScreen,
  Pill,
  Row,
  SectionHeader,
  TopBar,
  typography,
} from '../../src/components/healthfolio';
import {
  deleteDocument,
  getDocument,
  getDownloadUrl,
  patchDocument,
} from '../../src/lib/api/endpoints';
import { colors, spacing } from '../../src/theme/tokens';

const DOC_TYPE_LABELS: Record<DocType, string> = {
  [DocType.LabReport]: 'Blood work',
  [DocType.Prescription]: 'Prescription',
  [DocType.ImagingReport]: 'X-ray / CT / MRI',
  [DocType.DischargeSummary]: 'Surgery',
  [DocType.VaccinationRecord]: 'Vaccine',
  [DocType.Other]: 'Document',
};

const STATUS_LABELS: Record<OcrStatus, string> = {
  [OcrStatus.PendingUpload]: 'Pending upload',
  [OcrStatus.Queued]: 'Queued',
  [OcrStatus.Processing]: 'Processing',
  [OcrStatus.ReadyForReview]: 'Ready',
  [OcrStatus.Failed]: 'Failed',
};

function statusTone(status: OcrStatus): 'green' | 'amber' | 'blue' | 'red' | 'neutral' {
  if (status === OcrStatus.ReadyForReview) return 'green';
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

function confidenceAverage(readings: ParameterReading[]): number | null {
  if (readings.length === 0) return null;
  const total = readings.reduce((sum, reading) => sum + reading.confidenceScore, 0);
  return Math.round((total / readings.length) * 100);
}

function recordScore(status: OcrStatus, readings: ParameterReading[]): number {
  if (status === OcrStatus.Failed) return 24;
  if (isPolling(status)) return 62;
  if (status === OcrStatus.PendingUpload) return 42;
  if (readings.length === 0) return 72;

  const confidence = confidenceAverage(readings) ?? 72;
  const attention = readings.filter((reading) => {
    const flag = reading.rangeFlag as RangeFlag;
    return flag !== RangeFlag.Normal && flag !== RangeFlag.Unknown;
  }).length;

  return Math.max(54, Math.min(96, 68 + Math.round(confidence / 4) - attention * 4));
}

function scoreFormulaCopy(status: OcrStatus, readings: ParameterReading[]): string {
  if (status === OcrStatus.Failed) return 'OCR failed, so the score is intentionally low.';
  if (isPolling(status)) return 'The file is still being processed, so the score is temporary.';
  if (readings.length === 0) return 'File is saved, but no biomarker values were extracted.';

  const confidence = confidenceAverage(readings) ?? 0;
  const attention = readings.filter((reading) => {
    const flag = reading.rangeFlag as RangeFlag;
    return flag !== RangeFlag.Normal && flag !== RangeFlag.Unknown;
  }).length;

  return `${readings.length} values, ${confidence}% average OCR trust, ${attention} item${
    attention === 1 ? '' : 's'
  } needing review.`;
}

type RemoteFileMetadata = {
  contentLength: number | null;
  contentType: string | null;
};

async function fetchRemoteFileMetadata(url: string): Promise<RemoteFileMetadata> {
  const response = await fetch(url, { method: 'HEAD' });
  if (!response.ok) throw new Error('File metadata is not available yet.');

  const contentLength = response.headers.get('content-length');
  return {
    contentLength: contentLength ? Number(contentLength) : null,
    contentType: response.headers.get('content-type'),
  };
}

function fileTypeLabel(fileType?: string | null): string {
  if (!fileType) return 'File';
  if (fileType.includes('pdf')) return 'PDF';
  if (fileType.startsWith('image/')) return 'Image';
  return 'File';
}

function formatBytes(value?: number | null): string {
  if (!value || Number.isNaN(value)) return 'Not available';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(value?: string | null): string {
  if (!value) return 'Not available';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not available';
  return parsed.toLocaleString();
}

function appendPrescriptionApproval(notes?: string | null): string {
  const marker = 'Prescription OCR approved by user';
  if (notes?.includes(marker)) return notes;
  const stamp = new Date().toLocaleDateString();
  return [notes?.trim(), `${marker} on ${stamp}.`].filter(Boolean).join('\n');
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
    refetchOnMount: 'always',
    refetchOnReconnect: 'always',
  });

  const fileQuery = useQuery({
    queryKey: ['document-file-url', id],
    queryFn: () => getDownloadUrl(id),
    enabled: Boolean(data?.document.fileUrl),
    staleTime: 4 * 60 * 1000,
  });

  const fileMetadataQuery = useQuery({
    queryKey: ['document-file-metadata', id, fileQuery.data?.downloadUrl],
    queryFn: () => fetchRemoteFileMetadata(fileQuery.data?.downloadUrl as string),
    enabled: Boolean(fileQuery.data?.downloadUrl),
    staleTime: 4 * 60 * 1000,
    retry: 1,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteDocument(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['documents'] });
      router.back();
    },
  });

  const approvePrescriptionMutation = useMutation({
    mutationFn: (notes?: string | null) =>
      patchDocument(id, { notes: appendPrescriptionApproval(notes) }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['document', id] });
      await qc.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  function confirmDelete(): void {
    Alert.alert('Delete document', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
    ]);
  }

  async function resolveDownloadUrl(): Promise<string> {
    if (fileQuery.data?.downloadUrl) return fileQuery.data.downloadUrl;
    const result = await fileQuery.refetch();
    if (result.error) throw result.error;
    if (!result.data?.downloadUrl) throw new Error('Source file is not available yet.');
    return result.data.downloadUrl;
  }

  async function openSourceFile(): Promise<void> {
    try {
      const url = await resolveDownloadUrl();
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Could not open file', error instanceof Error ? error.message : 'Try again.');
    }
  }

  async function shareSourceFile(): Promise<void> {
    try {
      const url = await resolveDownloadUrl();
      await Share.share({
        url,
        message: `HealthFolio document\n${url}`,
      });
    } catch (error) {
      Alert.alert('Could not share file', error instanceof Error ? error.message : 'Try again.');
    }
  }

  if (isLoading || !data) return <LoadingScreen />;

  const { document: doc, readings } = data;
  const status = doc.ocrStatus as OcrStatus;
  const confidence = confidenceAverage(readings);
  const score = recordScore(status, readings);
  const fileUrl = fileQuery.data?.downloadUrl;
  const canPreviewImage = Boolean(doc.fileType?.startsWith('image/') && fileUrl);
  const isPdf = doc.fileType?.includes('pdf') ?? false;
  const fileMetadata = fileMetadataQuery.data;
  const prescriptionApproved = doc.notes?.includes('Prescription OCR approved by user') ?? false;

  return (
    <AppScroll>
      <TopBar
        title={DOC_TYPE_LABELS[doc.docType as DocType] ?? doc.docType}
        action={
          <View style={styles.topActions}>
            <Pill label={STATUS_LABELS[status] ?? status} tone={statusTone(status)} />
            <IconButton
              icon="arrow-left"
              label="Back"
              variant="secondary"
              onPress={() => router.back()}
            />
          </View>
        }
      />

      <View style={styles.recordHero}>
        <View style={styles.recordHeroTop}>
          <View>
            <Text style={styles.heroLabel}>Score</Text>
            <View style={styles.heroScoreRow}>
              <Text style={styles.heroScore}>{score}</Text>
              <Text style={styles.heroScoreSuffix}>/100</Text>
            </View>
          </View>
          <Pill label={STATUS_LABELS[status] ?? status} tone={statusTone(status)} />
        </View>
        <View style={styles.heroMetricRow}>
          <MiniStat label="Values" value={readings.length} />
          <MiniStat label="Trust" value={confidence ? `${confidence}%` : '-'} />
          <MiniStat label="Source" value={doc.labName ? 'Matched' : 'Pending'} />
        </View>
      </View>

      <Card>
        <SectionHeader
          icon="file-text"
          title="Original file"
          right={doc.fileType ? <Pill label={fileTypeLabel(doc.fileType)} tone="neutral" /> : null}
          style={styles.cardHeader}
        />
        {canPreviewImage && fileUrl ? (
          <Image source={{ uri: fileUrl }} resizeMode="contain" style={styles.previewImage} />
        ) : (
          <View style={styles.filePreview}>
            <Text style={styles.filePreviewTitle}>{isPdf ? 'PDF report' : 'Uploaded source'}</Text>
            <Text style={styles.filePreviewCopy}>
              {isPdf
                ? 'Open the original PDF for page review.'
                : 'Open or share the original file.'}
            </Text>
          </View>
        )}
        <View style={styles.fileMetadata}>
          <MetadataCell label="Type" value={fileMetadata?.contentType ?? doc.fileType ?? 'File'} />
          <MetadataCell label="Size" value={formatBytes(fileMetadata?.contentLength)} />
          <MetadataCell label="Source" value={doc.fileUrl ? 'Secure storage' : 'No file'} />
          <MetadataCell label="Added" value={formatDateTime(doc.createdAt)} />
          <MetadataCell label="Record date" value={new Date(doc.sourceDate).toLocaleDateString()} />
          <MetadataCell label="OCR completed" value={formatDateTime(doc.ocrCompletedAt)} />
        </View>
        <View style={styles.fileActions}>
          <Button
            label="Open"
            variant="secondary"
            disabled={!doc.fileUrl || fileQuery.isFetching}
            onPress={() => void openSourceFile()}
            style={styles.fileActionButton}
          />
          <Button
            label="Share"
            variant="secondary"
            disabled={!doc.fileUrl || fileQuery.isFetching}
            onPress={() => void shareSourceFile()}
            style={styles.fileActionButton}
          />
        </View>
      </Card>

      <Card>
        <SectionHeader icon="info" title="Score calculation" style={styles.cardHeader} />
        <Text style={styles.scoreExplain}>{scoreFormulaCopy(status, readings)}</Text>
        <View style={styles.scoreFactors}>
          <MetadataCell label="OCR state" value={STATUS_LABELS[status] ?? status} compact />
          <MetadataCell label="Values" value={String(readings.length)} compact />
          <MetadataCell
            label="Avg trust"
            value={confidence !== null ? `${confidence}%` : 'Not available'}
            compact
          />
        </View>
        <Text style={styles.scoreDisclaimer}>
          This score reflects record completeness and OCR confidence only. It is not medical advice.
        </Text>
      </Card>

      {doc.docType === DocType.Prescription ? (
        <Card style={styles.prescriptionCard}>
          <SectionHeader icon="edit-3" title="Prescription check" style={styles.cardHeader} />
          <Text style={styles.prescriptionCopy}>
            Handwriting OCR can be wrong. Review the original file before using extracted medicine
            names, dosage, or timing.
          </Text>
          <Button
            label={prescriptionApproved ? 'Approved' : 'Approve OCR'}
            variant={prescriptionApproved ? 'secondary' : 'primary'}
            disabled={prescriptionApproved}
            loading={approvePrescriptionMutation.isPending}
            onPress={() => approvePrescriptionMutation.mutate(doc.notes)}
            style={styles.prescriptionButton}
          />
        </Card>
      ) : null}

      <Card>
        <Row
          title={doc.labName ?? 'Unknown source'}
          subtitle={new Date(doc.sourceDate).toLocaleDateString()}
        />
        {doc.orderingPhysician ? <Row title="Doctor" subtitle={doc.orderingPhysician} /> : null}
        {doc.notes ? <Row title="Notes" subtitle={doc.notes} /> : null}
      </Card>

      <Card>
        <Text style={typography.h3}>Status</Text>
        <PipelineStep number="1" title="Uploaded" subtitle="File received." done />
        <PipelineStep
          number="2"
          title={isPolling(status) ? 'Reading' : 'Read'}
          subtitle={isPolling(status) ? 'Extracting values.' : 'Values extracted.'}
          done={status !== OcrStatus.PendingUpload}
        />
        <PipelineStep
          number="3"
          title="Ready"
          subtitle="Saved to Trends."
          done={status === OcrStatus.ReadyForReview}
          pending={status !== OcrStatus.ReadyForReview}
        />
      </Card>

      {status === OcrStatus.ReadyForReview && readings.length > 0 ? (
        <Card>
          <View style={styles.reviewHeader}>
            <View>
              <Text style={typography.h3}>Values</Text>
            </View>
            <Pill label={`${readings.length} values`} tone="blue" />
          </View>
          {readings.map((reading) => (
            <ReadingRow key={reading.id} reading={reading} />
          ))}
        </Card>
      ) : null}

      {isPolling(status) ? (
        <Card>
          <Text style={typography.h3}>Reading report</Text>
          <Text style={[typography.body, { marginTop: spacing.xs }]}>
            This refreshes automatically.
          </Text>
        </Card>
      ) : null}

      {status === OcrStatus.Failed ? (
        <Card style={styles.failedCard}>
          <Text style={styles.failedTitle}>OCR failed</Text>
          <Text style={typography.bodySmall}>Try a clearer upload or add readings manually.</Text>
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

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.miniStat}>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        style={styles.miniStatValue}
      >
        {value}
      </Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  );
}

function MetadataCell({
  label,
  value,
  compact,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <View style={[styles.metadataCell, compact && styles.metadataCellCompact]}>
      <Text style={styles.metadataLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.metadataValue}>
        {value}
      </Text>
    </View>
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
      subtitle={`${Math.round(reading.confidenceScore * 100)}% trust`}
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
  recordHero: {
    borderWidth: 0,
    borderRadius: 26,
    backgroundColor: colors.navy,
    padding: spacing.lg,
    marginBottom: 12,
    shadowColor: '#102533',
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
  },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  recordHeroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  heroLabel: {
    color: 'rgba(215,231,241,0.72)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  heroScoreRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: spacing.xs },
  heroScore: { color: '#FFFFFF', fontSize: 64, lineHeight: 68, fontWeight: '700' },
  heroScoreSuffix: {
    color: colors.secondary,
    fontSize: 19,
    lineHeight: 31,
    fontWeight: '700',
    marginLeft: 2,
  },
  heroMetricRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  miniStat: {
    flex: 1,
    minHeight: 58,
    justifyContent: 'center',
    borderWidth: 0,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
  },
  miniStatValue: { color: colors.secondary, fontSize: 22, lineHeight: 27, fontWeight: '700' },
  miniStatLabel: {
    color: 'rgba(215,231,241,0.66)',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  cardHeader: { marginTop: 0, marginBottom: 0 },
  filePreview: {
    minHeight: 150,
    borderRadius: 20,
    justifyContent: 'center',
    backgroundColor: colors.surfaceInset,
    borderWidth: 1,
    borderColor: colors.mutedBorder,
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
  previewImage: {
    width: '100%',
    height: 260,
    borderRadius: 20,
    backgroundColor: colors.surfaceInset,
    borderWidth: 1,
    borderColor: colors.mutedBorder,
    marginTop: spacing.sm,
  },
  filePreviewTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
  },
  filePreviewCopy: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  fileMetadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  metadataCell: {
    width: '47%',
    minHeight: 58,
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.surfaceInset,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  metadataCellCompact: {
    minHeight: 52,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.mutedBorder,
  },
  metadataLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  metadataValue: {
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 2,
  },
  fileActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  fileActionButton: { flex: 1, marginTop: 0 },
  scoreExplain: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  scoreDisclaimer: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing.xs,
  },
  scoreFactors: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  prescriptionCard: { backgroundColor: colors.primaryBg },
  prescriptionCopy: {
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.sm,
  },
  prescriptionButton: { marginTop: spacing.md },
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
  stepDotText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  stepDotTextPending: { color: colors.textSecondary },
  stepTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  stepSubtitle: { color: colors.textSecondary, fontSize: 12, lineHeight: 16, marginTop: 2 },
  readingRight: { alignItems: 'flex-end', gap: 4 },
  readingValue: { color: colors.primary, fontSize: 17, lineHeight: 22, fontWeight: '700' },
  failedCard: { backgroundColor: colors.redBg },
  failedTitle: { color: colors.danger, fontSize: 15, fontWeight: '700', marginBottom: spacing.xs },
});
