import {
  DocType,
  OcrStatus,
  RangeFlag,
  type DocumentDetail,
  type ParameterReading,
} from '@medical-tracker/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../src/components/ui';
import { deleteDocument, getDocument } from '../../src/lib/api/endpoints';
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
  [OcrStatus.PendingUpload]: 'Pending Upload',
  [OcrStatus.Queued]: 'Queued for OCR',
  [OcrStatus.Processing]: 'Processing…',
  [OcrStatus.ReadyForReview]: 'Ready for Review',
  [OcrStatus.Failed]: 'OCR Failed',
};

const STATUS_COLORS: Record<OcrStatus, string> = {
  [OcrStatus.PendingUpload]: colors.textSecondary,
  [OcrStatus.Queued]: '#4285F4',
  [OcrStatus.Processing]: '#F4B400',
  [OcrStatus.ReadyForReview]: colors.rangeNormal,
  [OcrStatus.Failed]: colors.danger,
};

const RANGE_FLAG_COLORS: Record<RangeFlag, string> = {
  [RangeFlag.Normal]: colors.rangeNormal,
  [RangeFlag.Low]: colors.rangeLow,
  [RangeFlag.High]: colors.rangeHigh,
  [RangeFlag.Critical]: colors.rangeCritical,
  [RangeFlag.Unknown]: colors.textSecondary,
};

function isPolling(status: OcrStatus): boolean {
  return status === OcrStatus.Queued || status === OcrStatus.Processing;
}

function ReadingRow({ reading }: { reading: ParameterReading }) {
  const flagColor = RANGE_FLAG_COLORS[reading.rangeFlag as RangeFlag] ?? colors.textSecondary;
  const confidence = Math.round(reading.confidenceScore * 100);
  return (
    <View style={styles.readingRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.readingParam}>{reading.parameterId.replace(/-/g, ' ')}</Text>
        <Text style={styles.readingMeta}>{confidence}% confidence</Text>
      </View>
      <View style={styles.readingRight}>
        <Text style={styles.readingValue}>
          {reading.value} {reading.unit}
        </Text>
        <Text style={[styles.readingFlag, { color: flagColor }]}>{reading.rangeFlag}</Text>
      </View>
    </View>
  );
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
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteMutation.mutate(),
      },
    ]);
  }

  if (isLoading || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  const { document: doc, readings } = data;
  const ocrStatus = doc.ocrStatus as OcrStatus;
  const statusColor = STATUS_COLORS[ocrStatus] ?? colors.textSecondary;
  const statusLabel = STATUS_LABELS[ocrStatus] ?? ocrStatus;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>
            {DOC_TYPE_LABELS[doc.docType as DocType] ?? doc.docType}
          </Text>
          <Text style={[styles.statusBadge, { color: statusColor }]}>{statusLabel}</Text>
        </View>
        <Row label="Date" value={new Date(doc.sourceDate).toLocaleDateString()} />
        {doc.labName ? <Row label="Lab" value={doc.labName} /> : null}
        {doc.orderingPhysician ? <Row label="Physician" value={doc.orderingPhysician} /> : null}
        {doc.notes ? <Row label="Notes" value={doc.notes} /> : null}
        <Row label="Attempts" value={String(doc.ocrAttempts)} />
      </View>

      {ocrStatus === OcrStatus.ReadyForReview && readings.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Extracted Readings ({readings.length})</Text>
          <Text style={styles.reviewNote}>
            Review and confirm these values before they count toward your trends.
          </Text>
          {readings.map((r) => (
            <ReadingRow key={r.id} reading={r} />
          ))}
        </View>
      ) : null}

      {ocrStatus === OcrStatus.ReadyForReview && readings.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>No readings extracted</Text>
          <Text style={styles.reviewNote}>
            OCR completed but no matching parameters were found. You can add readings manually in a
            future update.
          </Text>
        </View>
      ) : null}

      {isPolling(ocrStatus) ? (
        <View style={styles.card}>
          <Text style={styles.reviewNote}>
            OCR is in progress. This screen refreshes automatically every few seconds.
          </Text>
        </View>
      ) : null}

      {ocrStatus === OcrStatus.Failed ? (
        <View style={styles.card}>
          <Text style={[styles.cardTitle, { color: colors.danger }]}>OCR Failed</Text>
          <Text style={styles.reviewNote}>
            The OCR pipeline could not process this document. Try re-uploading a clearer image.
          </Text>
        </View>
      ) : null}

      <Button
        label="Delete Document"
        variant="danger"
        loading={deleteMutation.isPending}
        onPress={confirmDelete}
      />
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  loadingText: { fontSize: 16, color: colors.textSecondary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.primary },
  statusBadge: { fontSize: 12, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowLabel: { fontSize: 14, color: colors.textSecondary },
  rowValue: { fontSize: 14, color: colors.textPrimary, flexShrink: 1, textAlign: 'right', marginLeft: spacing.md },
  reviewNote: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: spacing.sm },
  readingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  readingParam: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, textTransform: 'capitalize' },
  readingMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  readingRight: { alignItems: 'flex-end' },
  readingValue: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  readingFlag: { fontSize: 12, marginTop: 2, textTransform: 'uppercase', fontWeight: '600' },
});
