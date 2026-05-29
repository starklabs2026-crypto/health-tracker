import { findById, formatRange } from '@medical-tracker/parameter-catalog';
import { RangeFlag, ReadingStatus, type TrendResponse } from '@medical-tracker/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, LayoutChangeEvent, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  AppScroll,
  Button,
  Card,
  CenteredScreen,
  HeroCard,
  LoadingScreen,
  Pill,
  Row,
  TopBar,
  typography,
} from '../../src/components/healthfolio';
import { TextField } from '../../src/components/ui';
import {
  createReading,
  deleteReading,
  getTrend,
  listDocuments,
  patchReading,
} from '../../src/lib/api/endpoints';
import { useProfileStore } from '../../src/lib/profile/profileStore';
import { colors, spacing } from '../../src/theme/tokens';

function flagTone(flag?: RangeFlag): 'green' | 'amber' | 'red' | 'neutral' {
  if (!flag || flag === RangeFlag.Unknown) return 'neutral';
  if (flag === RangeFlag.Normal) return 'green';
  if (flag === RangeFlag.Critical) return 'red';
  return 'amber';
}

function flagColor(flag?: RangeFlag): string {
  if (flag === RangeFlag.Critical) return colors.danger;
  if (flag && flag !== RangeFlag.Normal && flag !== RangeFlag.Unknown) return colors.amber;
  return colors.primary;
}

function isDateInput(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatShortDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

type ChartPoint = TrendResponse['data'][number] & { x: number; y: number };

export default function ParameterHistoryScreen() {
  const { parameterId } = useLocalSearchParams<{ parameterId: string }>();
  const { activeProfileId } = useProfileStore();
  const qc = useQueryClient();
  const entry = findById(parameterId);
  const [adding, setAdding] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newUnit, setNewUnit] = useState(entry?.unit ?? '');
  const [selectedReadingId, setSelectedReadingId] = useState<string | null>(null);

  const { data: trend, isLoading } = useQuery<TrendResponse>({
    queryKey: ['trend', parameterId, activeProfileId],
    queryFn: () =>
      getTrend(parameterId, { ...(activeProfileId ? { profileId: activeProfileId } : {}) }),
    enabled: !!parameterId,
  });

  const { data: documentList } = useQuery({
    queryKey: ['documents-context', activeProfileId],
    queryFn: () =>
      listDocuments({ ...(activeProfileId ? { profileId: activeProfileId } : {}), limit: 200 }),
    enabled: !!trend?.data.some((point) => point.documentId),
  });

  const addMutation = useMutation({
    mutationFn: () =>
      createReading({
        ...(activeProfileId ? { ownerProfileId: activeProfileId } : {}),
        parameterId,
        value: parseFloat(newValue),
        unit: newUnit || (entry?.unit ?? ''),
        recordedAt: newDate,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['trend', parameterId, activeProfileId] });
      await qc.invalidateQueries({ queryKey: ['readings'] });
      setAdding(false);
      setNewValue('');
      setNewDate('');
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) =>
      patchReading(id, { status: ReadingStatus.Confirmed, isUserVerified: true }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['trend', parameterId, activeProfileId] });
      await qc.invalidateQueries({ queryKey: ['readings'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteReading(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['trend', parameterId, activeProfileId] });
      await qc.invalidateQueries({ queryKey: ['readings'] });
    },
  });

  const documentById = useMemo(() => {
    return new Map((documentList?.items ?? []).map((document) => [document.id, document]));
  }, [documentList]);

  useEffect(() => {
    const latestId = trend?.data[trend.data.length - 1]?.readingId ?? null;
    if (!selectedReadingId || !trend?.data.some((point) => point.readingId === selectedReadingId)) {
      setSelectedReadingId(latestId);
    }
  }, [selectedReadingId, trend]);

  function confirmDelete(id: string): void {
    Alert.alert('Delete reading', 'Remove this data point?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ]);
  }

  if (!entry) {
    return (
      <CenteredScreen>
        <Text style={styles.error}>Unknown parameter.</Text>
      </CenteredScreen>
    );
  }
  if (isLoading) return <LoadingScreen />;

  const data = trend?.data ?? [];
  const latest = data[data.length - 1];
  const selectedPoint =
    data.find((point) => point.readingId === selectedReadingId) ?? latest ?? null;
  const selectedDocument =
    selectedPoint?.sourceDocument ??
    (selectedPoint?.documentId ? documentById.get(selectedPoint.documentId) : undefined);
  const rangeLabel = formatRange(entry);
  const canSaveReading = !!newValue && !Number.isNaN(parseFloat(newValue)) && isDateInput(newDate);

  return (
    <AppScroll>
      <TopBar
        eyebrow={entry.panel}
        title={entry.canonicalName}
        action={
          latest ? <Pill label={latest.rangeFlag} tone={flagTone(latest.rangeFlag)} /> : undefined
        }
      />

      <HeroCard tone="light">
        <Text style={typography.bodySmall}>Latest value</Text>
        {latest ? (
          <Text style={styles.latest}>
            {latest.value} {latest.unit}
          </Text>
        ) : (
          <Text style={styles.latest}>No data</Text>
        )}
        <Text style={typography.bodySmall}>Normal range: {rangeLabel}</Text>
      </HeroCard>

      <Card>
        <Text style={typography.h3}>Timeline</Text>
        <TimelineChart
          data={data}
          selectedReadingId={selectedReadingId}
          onSelect={setSelectedReadingId}
        />
        {selectedPoint ? (
          <View style={styles.pointCard}>
            <View style={styles.pointHeader}>
              <Text style={styles.pointValue}>
                {selectedPoint.value} {selectedPoint.unit}
              </Text>
              <Pill label={selectedPoint.rangeFlag} tone={flagTone(selectedPoint.rangeFlag)} />
            </View>
            <Text style={styles.pointDate}>{formatShortDate(selectedPoint.recordedAt)}</Text>
            <Text style={styles.pointMeta}>
              {selectedPoint.isUserVerified ? 'Confirmed' : 'Pending review'} •{' '}
              {Math.round(selectedPoint.confidenceScore * 100)}% confidence
            </Text>
            {selectedDocument ? (
              <View style={styles.pointContext}>
                <Text style={styles.pointContextText}>
                  {selectedDocument.labName ?? 'Linked report'} •{' '}
                  {selectedDocument.docType.replace(/_/g, ' ')} •{' '}
                  {new Date(selectedDocument.sourceDate).toLocaleDateString()}
                </Text>
                <Button
                  label="Open report"
                  variant="secondary"
                  onPress={() => router.push(`/documents/${selectedDocument.id}`)}
                  style={styles.pointButton}
                />
              </View>
            ) : (
              <Text style={styles.pointContextText}>Saved without a linked report.</Text>
            )}
          </View>
        ) : null}
      </Card>

      <Card>
        <View style={styles.historyHeader}>
          <Text style={typography.h3}>History</Text>
          <Button
            label="Add"
            variant="secondary"
            onPress={() => setAdding(true)}
            style={styles.addButton}
          />
        </View>
        {data.length === 0 ? (
          <Text style={typography.body}>No readings recorded.</Text>
        ) : (
          [...data].reverse().map((point) => (
            <Row
              key={point.readingId}
              title={`${point.value} ${point.unit}`}
              subtitle={new Date(point.recordedAt).toLocaleDateString()}
              right={
                <View style={styles.historyRight}>
                  <Pill label={point.rangeFlag} tone={flagTone(point.rangeFlag)} />
                  {!point.isUserVerified ? (
                    <Pressable onPress={() => confirmMutation.mutate(point.readingId)}>
                      <Text style={styles.confirmText}>Confirm</Text>
                    </Pressable>
                  ) : null}
                  <Pressable onPress={() => confirmDelete(point.readingId)}>
                    <Text style={styles.deleteText}>Delete</Text>
                  </Pressable>
                </View>
              }
              onPress={() => setSelectedReadingId(point.readingId)}
            />
          ))
        )}
      </Card>

      <Modal visible={adding} animationType="slide" onRequestClose={() => setAdding(false)}>
        <AppScroll contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
          <Text style={typography.h2}>Add {entry.canonicalName}</Text>
          <View style={{ marginTop: spacing.md }}>
            <TextField
              label={`Value (${entry.unit})`}
              value={newValue}
              onChangeText={setNewValue}
              keyboardType="decimal-pad"
              placeholder=""
            />
            <TextField
              label="Unit"
              value={newUnit}
              onChangeText={setNewUnit}
              placeholder={entry.unit}
            />
            <TextField
              label="Date (YYYY-MM-DD)"
              value={newDate}
              onChangeText={setNewDate}
              placeholder="YYYY-MM-DD"
              keyboardType="numeric"
            />
          </View>
          <Button
            label="Save"
            loading={addMutation.isPending}
            disabled={!canSaveReading}
            onPress={() => addMutation.mutate()}
          />
          <Button label="Cancel" variant="secondary" onPress={() => setAdding(false)} />
        </AppScroll>
      </Modal>
    </AppScroll>
  );
}

function TimelineChart({
  data,
  selectedReadingId,
  onSelect,
}: {
  data: TrendResponse['data'];
  selectedReadingId: string | null;
  onSelect: (readingId: string) => void;
}) {
  const [width, setWidth] = useState(0);

  const points = useMemo<ChartPoint[]>(() => {
    if (!width || data.length === 0) return [];

    const chartHeight = 170;
    const insetX = 18;
    const insetY = 18;
    const usableWidth = Math.max(width - insetX * 2, 1);
    const usableHeight = chartHeight - insetY * 2;
    const values = data.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    return data.map((point, index) => {
      const ratio = range === 0 ? 0.52 : (point.value - min) / range;
      const x =
        data.length === 1
          ? width / 2
          : insetX + (usableWidth * index) / Math.max(data.length - 1, 1);
      const y = chartHeight - insetY - ratio * usableHeight;
      return { ...point, x, y };
    });
  }, [data, width]);

  function onLayout(event: LayoutChangeEvent): void {
    setWidth(event.nativeEvent.layout.width);
  }

  if (data.length === 0) {
    return <Text style={[typography.body, styles.chartEmpty]}>No timeline yet.</Text>;
  }

  return (
    <View style={styles.chartWrap}>
      <View style={styles.chartCanvas} onLayout={onLayout}>
        <View style={[styles.chartBand, styles.chartBandTop]} />
        <View style={[styles.chartBand, styles.chartBandBottom]} />
        <View style={styles.chartGuideTop} />
        <View style={styles.chartGuideMiddle} />
        <View style={styles.chartGuideBottom} />

        {points.slice(1).map((point, index) => {
          const previous = points[index];
          const dx = point.x - previous.x;
          const dy = point.y - previous.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx);
          return (
            <View
              key={`${previous.readingId}-${point.readingId}`}
              style={[
                styles.chartSegment,
                {
                  left: previous.x + dx / 2 - length / 2,
                  top: previous.y + dy / 2 - 2,
                  width: length,
                  backgroundColor: flagColor(point.rangeFlag),
                  transform: [{ rotateZ: `${angle}rad` }],
                },
              ]}
            />
          );
        })}

        {points.map((point) => {
          const selected = point.readingId === selectedReadingId;
          return (
            <Pressable
              key={point.readingId}
              accessibilityRole="button"
              onPress={() => onSelect(point.readingId)}
              style={[
                styles.chartPointHit,
                {
                  left: point.x - 19,
                  top: point.y - 19,
                },
              ]}
            >
              {selected ? (
                <View
                  style={[styles.chartPointHalo, { borderColor: flagColor(point.rangeFlag) }]}
                />
              ) : null}
              <View
                style={[
                  styles.chartPoint,
                  selected && styles.chartPointSelected,
                  {
                    borderColor: flagColor(point.rangeFlag),
                    backgroundColor: selected ? flagColor(point.rangeFlag) : '#FFFFFF',
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.chartLabels}>
        <Text style={styles.chartLabel}>{formatShortDate(data[0].recordedAt)}</Text>
        <Text style={styles.chartLabel}>{formatShortDate(data[data.length - 1].recordedAt)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger, fontSize: 16 },
  latest: {
    color: colors.textPrimary,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    marginVertical: spacing.xs,
  },
  chartWrap: { marginTop: spacing.md },
  chartCanvas: {
    height: 170,
    borderRadius: 18,
    backgroundColor: '#F4FBF8',
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(15,118,110,0.12)',
  },
  chartBand: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  chartBandTop: {
    top: 0,
    height: 62,
    backgroundColor: 'rgba(37,99,235,0.06)',
  },
  chartBandBottom: {
    bottom: 0,
    height: 62,
    backgroundColor: 'rgba(15,118,110,0.08)',
  },
  chartGuideTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(15,118,110,0.14)',
  },
  chartGuideMiddle: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 85,
    borderTopWidth: 1,
    borderColor: 'rgba(15,118,110,0.12)',
  },
  chartGuideBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 142,
    borderTopWidth: 1,
    borderColor: 'rgba(15,118,110,0.14)',
  },
  chartSegment: {
    position: 'absolute',
    height: 4,
    borderRadius: 99,
    backgroundColor: colors.primary,
  },
  chartPointHit: {
    position: 'absolute',
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartPointHalo: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.68)',
  },
  chartPoint: {
    width: 14,
    height: 14,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
  },
  chartPointSelected: {
    width: 18,
    height: 18,
    borderColor: '#FFFFFF',
    borderWidth: 3,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  chartLabel: { color: colors.textSecondary, fontSize: 11, lineHeight: 15 },
  chartEmpty: { marginTop: spacing.sm },
  pointCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 18,
    backgroundColor: '#FBFDFD',
    borderWidth: 1,
    borderColor: 'rgba(15,118,110,0.18)',
    gap: spacing.xs,
  },
  pointHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pointValue: { color: colors.textPrimary, fontSize: 20, lineHeight: 25, fontWeight: '800' },
  pointDate: { color: colors.textSecondary, fontSize: 12, lineHeight: 16 },
  pointMeta: { color: colors.textSecondary, fontSize: 12, lineHeight: 16 },
  pointContext: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  pointContextText: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, flex: 1 },
  pointButton: { minHeight: 34, marginTop: 0, paddingHorizontal: spacing.sm },
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addButton: { width: 72, marginTop: 0 },
  historyRight: { alignItems: 'flex-end', gap: 4 },
  confirmText: { color: colors.amber, fontSize: 11, fontWeight: '800' },
  deleteText: { color: colors.textSecondary, fontSize: 11, fontWeight: '800' },
});
