import { findById, formatRange } from '@medical-tracker/parameter-catalog';
import { RangeFlag, type TrendResponse } from '@medical-tracker/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  LayoutChangeEvent,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  AppScroll,
  Button,
  Card,
  CenteredScreen,
  HeroCard,
  IconButton,
  LoadingScreen,
  Pill,
  Row,
  SectionHeader,
  TopBar,
  typography,
} from '../../src/components/healthfolio';
import { TextField } from '../../src/components/ui';
import { createReading, deleteReading, getTrend, listDocuments } from '../../src/lib/api/endpoints';
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

function signalScore(flag?: RangeFlag, confidence?: number): number | null {
  if (!flag) return null;
  const confidenceBoost = confidence ? Math.round((confidence - 70) / 5) : 0;
  if (flag === RangeFlag.Normal) return Math.max(78, Math.min(98, 88 + confidenceBoost));
  if (flag === RangeFlag.Unknown) return Math.max(55, Math.min(78, 66 + confidenceBoost));
  if (flag === RangeFlag.Critical) return Math.max(24, Math.min(52, 42 + confidenceBoost));
  return Math.max(50, Math.min(74, 62 + confidenceBoost));
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
  const currentEntry = entry;
  if (isLoading) return <LoadingScreen />;

  const data = trend?.data ?? [];
  const latest = data[data.length - 1];
  const selectedPoint =
    data.find((point) => point.readingId === selectedReadingId) ?? latest ?? null;
  const selectedDocument =
    selectedPoint?.sourceDocument ??
    (selectedPoint?.documentId ? documentById.get(selectedPoint.documentId) : undefined);
  const rangeLabel = trend?.rangeLabel ?? formatRange(currentEntry);
  const canSaveReading = !!newValue && !Number.isNaN(parseFloat(newValue)) && isDateInput(newDate);
  const latestConfidence = latest ? Math.round(latest.confidenceScore * 100) : null;
  const latestScore = signalScore(latest?.rangeFlag, latestConfidence ?? undefined);

  async function shareSelectedPoint(): Promise<void> {
    if (!selectedPoint) return;

    await Share.share({
      message: [
        `${currentEntry.canonicalName}: ${selectedPoint.value} ${selectedPoint.unit}`,
        `Date: ${formatShortDate(selectedPoint.recordedAt)}`,
        `Status: ${selectedPoint.rangeFlag}`,
        `Reference: ${rangeLabel}`,
        '',
        'Shared from HealthFolio. This is user-provided record data, not medical advice.',
      ].join('\n'),
    });
  }

  return (
    <AppScroll>
      <TopBar
        title={currentEntry.canonicalName}
        action={
          <View style={styles.topActions}>
            {latest ? <Pill label={latest.rangeFlag} tone={flagTone(latest.rangeFlag)} /> : null}
            <IconButton
              icon="arrow-left"
              label="Back"
              variant="secondary"
              onPress={() => router.back()}
            />
          </View>
        }
      />

      <HeroCard tone="light" style={styles.signalHero}>
        <View style={styles.signalTop}>
          <View>
            <Text style={styles.signalLabel}>Latest</Text>
            {latest ? (
              <Text style={styles.latest}>
                {latest.value} {latest.unit}
              </Text>
            ) : (
              <Text style={styles.latest}>No data</Text>
            )}
          </View>
          {latestScore ? (
            <View style={styles.scoreBadge}>
              <Text style={styles.scoreBadgeValue}>{latestScore}</Text>
              <Text style={styles.scoreBadgeLabel}>score</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.signalRange}>Normal {rangeLabel}</Text>
        <View style={styles.signalStats}>
          <SignalStat label="History" value={data.length} />
          <SignalStat label="Trust" value={latestConfidence ? `${latestConfidence}%` : '-'} />
          <SignalStat label="Status" value={latest?.rangeFlag ?? 'None'} />
        </View>
      </HeroCard>

      <Card>
        <View style={styles.rangeHeader}>
          <View style={{ flex: 1 }}>
            <SectionHeader icon="sliders" title="Range" style={styles.cardHeader} />
            <Text style={styles.rangeValue}>{rangeLabel}</Text>
          </View>
          {latest ? <Pill label={latest.rangeFlag} tone={flagTone(latest.rangeFlag)} /> : null}
        </View>
      </Card>

      <Card>
        <SectionHeader icon="trending-up" title="Timeline" style={styles.cardHeader} />
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
              {rangeLabel} - {Math.round(selectedPoint.confidenceScore * 100)}% trust
            </Text>
            <Button
              label="Share point"
              variant="secondary"
              onPress={() => void shareSelectedPoint()}
              style={styles.sharePointButton}
            />
            {selectedDocument ? (
              <View style={styles.pointContext}>
                <Text style={styles.pointContextText}>
                  {selectedDocument.labName ?? 'Linked report'} -{' '}
                  {selectedDocument.docType.replace(/_/g, ' ')} -{' '}
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
          <SectionHeader icon="clock" title="History" style={styles.cardHeader} />
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
          <Text style={typography.h2}>Add {currentEntry.canonicalName}</Text>
          <View style={{ marginTop: spacing.md }}>
            <TextField
              label={`Value (${currentEntry.unit})`}
              value={newValue}
              onChangeText={setNewValue}
              keyboardType="decimal-pad"
              placeholder=""
            />
            <TextField
              label="Unit"
              value={newUnit}
              onChangeText={setNewUnit}
              placeholder={currentEntry.unit}
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

function SignalStat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.signalStat}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.signalStatValue}>
        {value}
      </Text>
      <Text style={styles.signalStatLabel}>{label}</Text>
    </View>
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

  const selectedPoint =
    points.find((point) => point.readingId === selectedReadingId) ?? points[points.length - 1];
  const calloutLeft = selectedPoint
    ? Math.max(12, Math.min(width - 112, selectedPoint.x - 52))
    : 12;
  const calloutTop = selectedPoint ? Math.max(10, selectedPoint.y - 54) : 12;

  return (
    <View style={styles.chartWrap}>
      <View style={styles.chartCanvas} onLayout={onLayout}>
        <View style={[styles.chartBand, styles.chartBandTop]} />
        <View style={[styles.chartBand, styles.chartBandBottom]} />
        <View style={styles.chartGuideTop} />
        <View style={styles.chartGuideMiddle} />
        <View style={styles.chartGuideBottom} />

        {selectedPoint ? (
          <View style={[styles.chartSelectedGuide, { left: selectedPoint.x }]} />
        ) : null}

        {points.slice(1).flatMap((point, index) => {
          const previous = points[index];
          const segments = [];
          const steps = 7;
          for (let step = 0; step < steps; step += 1) {
            const t0 = step / steps;
            const t1 = (step + 1) / steps;
            const ease0 = t0 * t0 * (3 - 2 * t0);
            const ease1 = t1 * t1 * (3 - 2 * t1);
            const x0 = previous.x + (point.x - previous.x) * t0;
            const y0 = previous.y + (point.y - previous.y) * ease0;
            const x1 = previous.x + (point.x - previous.x) * t1;
            const y1 = previous.y + (point.y - previous.y) * ease1;
            const dx = x1 - x0;
            const dy = y1 - y0;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);
            segments.push(
              <View
                key={`${previous.readingId}-${point.readingId}-${step}`}
                style={[
                  styles.chartSegment,
                  {
                    left: x0 + dx / 2 - length / 2,
                    top: y0 + dy / 2 - 2,
                    width: length + 1,
                    backgroundColor: flagColor(point.rangeFlag),
                    opacity: 0.92,
                    transform: [{ rotateZ: `${angle}rad` }],
                  },
                ]}
              />,
            );
          }
          return segments;
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
                    backgroundColor: selected ? flagColor(point.rangeFlag) : colors.surfaceRaised,
                  },
                ]}
              />
            </Pressable>
          );
        })}

        {selectedPoint ? (
          <View style={[styles.chartCallout, { left: calloutLeft, top: calloutTop }]}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.chartCalloutValue}>
              {selectedPoint.value} {selectedPoint.unit}
            </Text>
          </View>
        ) : null}
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
  topActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  signalHero: { gap: spacing.md, backgroundColor: '#FFFFFF' },
  signalTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  signalLabel: { color: colors.textSecondary, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  latest: {
    color: colors.textPrimary,
    fontSize: 44,
    lineHeight: 49,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  scoreBadge: {
    width: 76,
    height: 76,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  scoreBadgeValue: { color: '#FFFFFF', fontSize: 27, lineHeight: 31, fontWeight: '700' },
  scoreBadgeLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  signalRange: { color: colors.textSecondary, fontSize: 12, lineHeight: 17 },
  signalStats: { flexDirection: 'row', gap: spacing.sm },
  signalStat: {
    flex: 1,
    minHeight: 58,
    justifyContent: 'center',
    borderWidth: 0,
    borderRadius: 18,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 10,
  },
  signalStatValue: { color: colors.textPrimary, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  signalStatLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  rangeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardHeader: { marginTop: 0 },
  rangeValue: {
    color: colors.textPrimary,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    marginTop: spacing.xs,
    marginBottom: 2,
  },
  sharePointButton: { marginTop: spacing.sm },
  chartWrap: { marginTop: spacing.md },
  chartCanvas: {
    height: 192,
    borderRadius: 24,
    backgroundColor: '#F8FBFD',
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 0,
  },
  chartBand: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  chartBandTop: {
    top: 0,
    height: 70,
    backgroundColor: colors.blueBg,
  },
  chartBandBottom: {
    bottom: 0,
    height: 70,
    backgroundColor: colors.greenBg,
  },
  chartGuideTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 28,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  chartGuideMiddle: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 85,
    borderTopWidth: 1,
    borderColor: colors.mutedBorder,
  },
  chartGuideBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 142,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  chartSegment: {
    position: 'absolute',
    height: 5,
    borderRadius: 99,
    backgroundColor: colors.primary,
  },
  chartSelectedGuide: {
    position: 'absolute',
    top: 18,
    bottom: 18,
    width: 1,
    backgroundColor: colors.border,
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
    backgroundColor: colors.primaryBg,
  },
  chartPoint: {
    width: 14,
    height: 14,
    borderRadius: 999,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 2,
  },
  chartPointSelected: {
    width: 20,
    height: 20,
    borderColor: '#FFFFFF',
    borderWidth: 4,
    shadowColor: colors.primary,
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  chartCallout: {
    position: 'absolute',
    minWidth: 104,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: colors.navy,
    paddingHorizontal: 12,
  },
  chartCalloutValue: { color: '#FFFFFF', fontSize: 12, lineHeight: 15, fontWeight: '700' },
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
    backgroundColor: colors.surfaceRaised,
    borderWidth: 0,
    gap: spacing.xs,
  },
  pointHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pointValue: { color: colors.textPrimary, fontSize: 20, lineHeight: 25, fontWeight: '700' },
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
  deleteText: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
});
