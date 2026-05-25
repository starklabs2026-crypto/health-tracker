import { findById, formatRange } from '@medical-tracker/parameter-catalog';
import {
  RangeFlag,
  ReadingStatus,
  type TrendResponse,
} from '@medical-tracker/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button, TextField } from '../../src/components/ui';
import {
  createReading,
  deleteReading,
  getTrend,
  patchReading,
} from '../../src/lib/api/endpoints';
import { colors, radius, spacing } from '../../src/theme/tokens';

const FLAG_COLORS: Record<RangeFlag, string> = {
  [RangeFlag.Normal]: colors.rangeNormal,
  [RangeFlag.Low]: colors.rangeLow,
  [RangeFlag.High]: colors.rangeHigh,
  [RangeFlag.Critical]: colors.rangeCritical,
  [RangeFlag.Unknown]: colors.textSecondary,
};

/** Simple sparkline: colored bars proportional to value within the dataset. */
function Sparkline({ data }: { data: TrendResponse['data'] }) {
  if (data.length < 2) return null;
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return (
    <View style={spark.container}>
      {data.map((pt) => {
        const heightPct = ((pt.value - min) / range) * 0.7 + 0.15; // 15–85% height
        const color = FLAG_COLORS[pt.rangeFlag] ?? colors.textSecondary;
        return (
          <View key={pt.readingId} style={spark.barWrapper}>
            <View style={[spark.bar, { height: `${Math.round(heightPct * 100)}%`, backgroundColor: color }]} />
          </View>
        );
      })}
    </View>
  );
}

const spark = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 60,
    gap: 3,
    marginVertical: spacing.sm,
  },
  barWrapper: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { borderRadius: 2, minHeight: 4 },
});

function trendArrow(data: TrendResponse['data']): string {
  if (data.length < 2) return '';
  const last = data[data.length - 1]?.value;
  const prev = data[data.length - 2]?.value;
  if (last === undefined || prev === undefined) return '';
  if (last > prev * 1.02) return ' ↑';
  if (last < prev * 0.98) return ' ↓';
  return ' →';
}

export default function ParameterHistoryScreen() {
  const { parameterId } = useLocalSearchParams<{ parameterId: string }>();
  const qc = useQueryClient();
  const entry = findById(parameterId);

  const [adding, setAdding] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0] ?? '');
  const [newUnit, setNewUnit] = useState(entry?.unit ?? '');

  const { data: trend, isLoading } = useQuery<TrendResponse>({
    queryKey: ['trend', parameterId],
    queryFn: () => getTrend(parameterId),
    enabled: !!parameterId,
  });

  const addMutation = useMutation({
    mutationFn: () =>
      createReading({
        parameterId,
        value: parseFloat(newValue),
        unit: newUnit || (entry?.unit ?? ''),
        recordedAt: newDate,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['trend', parameterId] });
      await qc.invalidateQueries({ queryKey: ['readings'] });
      setAdding(false);
      setNewValue('');
      setNewDate(new Date().toISOString().split('T')[0] ?? '');
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) =>
      patchReading(id, { status: ReadingStatus.Confirmed, isUserVerified: true }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['trend', parameterId] });
      await qc.invalidateQueries({ queryKey: ['readings'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteReading(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['trend', parameterId] });
      await qc.invalidateQueries({ queryKey: ['readings'] });
    },
  });

  function confirmDelete(id: string): void {
    Alert.alert('Delete reading', 'Remove this data point?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ]);
  }

  if (!entry) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Unknown parameter.</Text>
      </View>
    );
  }

  const rangeLabel = formatRange(entry);
  const data = trend?.data ?? [];
  const latest = data[data.length - 1];
  const latestFlagColor =
    latest ? (FLAG_COLORS[latest.rangeFlag] ?? colors.textSecondary) : colors.textSecondary;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      {/* Header card */}
      <View style={styles.card}>
        <Text style={styles.paramName}>{entry.canonicalName}</Text>
        <Text style={styles.unit}>{entry.unit}</Text>
        <Text style={styles.range}>Reference: {rangeLabel}</Text>
        {latest ? (
          <Text style={[styles.latestValue, { color: latestFlagColor }]}>
            {latest.value} {latest.unit}
            {trendArrow(data)}
          </Text>
        ) : (
          <Text style={styles.noData}>No readings yet</Text>
        )}
      </View>

      {/* Sparkline */}
      {data.length >= 2 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Trend ({data.length} readings)</Text>
          <Sparkline data={data} />
        </View>
      ) : null}

      {/* Reading history */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.sectionTitle}>History</Text>
          <Button label="+ Add" variant="secondary" onPress={() => setAdding(true)} />
        </View>
        {isLoading ? (
          <Text style={styles.loadingText}>Loading…</Text>
        ) : data.length === 0 ? (
          <Text style={styles.emptyText}>No readings recorded.</Text>
        ) : (
          [...data].reverse().map((pt) => {
            const flagColor = FLAG_COLORS[pt.rangeFlag] ?? colors.textSecondary;
            return (
              <View key={pt.readingId} style={styles.readingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.readingDate}>
                    {new Date(pt.recordedAt).toLocaleDateString()}
                  </Text>
                  {pt.isUserVerified ? (
                    <Text style={styles.verifiedBadge}>Verified</Text>
                  ) : (
                    <Pressable onPress={() => confirmMutation.mutate(pt.readingId)}>
                      <Text style={styles.confirmBadge}>Tap to confirm</Text>
                    </Pressable>
                  )}
                </View>
                <Text style={[styles.readingValue, { color: flagColor }]}>
                  {pt.value} {pt.unit}
                </Text>
                <Pressable
                  onPress={() => confirmDelete(pt.readingId)}
                  style={styles.deleteBtn}
                  accessibilityLabel="Delete reading"
                >
                  <Text style={styles.deleteBtnText}>✕</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </View>

      {/* Manual entry modal */}
      <Modal visible={adding} animationType="slide" onRequestClose={() => setAdding(false)}>
        <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
          <Text style={styles.modalTitle}>Add {entry.canonicalName}</Text>
          <TextField
            label={`Value (${entry.unit})`}
            value={newValue}
            onChangeText={setNewValue}
            keyboardType="decimal-pad"
            placeholder="e.g. 13.5"
          />
          <TextField
            label="Unit (pre-filled)"
            value={newUnit}
            onChangeText={setNewUnit}
            placeholder={entry.unit}
          />
          <TextField
            label="Date (YYYY-MM-DD)"
            value={newDate}
            onChangeText={setNewDate}
            placeholder="2024-01-15"
            keyboardType="numeric"
          />
          <Button
            label="Save"
            loading={addMutation.isPending}
            disabled={!newValue || isNaN(parseFloat(newValue))}
            onPress={() => addMutation.mutate()}
          />
          <Button label="Cancel" variant="secondary" onPress={() => setAdding(false)} />
        </ScrollView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  errorText: { fontSize: 16, color: colors.danger },
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
  paramName: { fontSize: 20, fontWeight: '700', color: colors.primary },
  unit: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  range: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs },
  latestValue: { fontSize: 28, fontWeight: '700', marginTop: spacing.sm },
  noData: { fontSize: 15, color: colors.textSecondary, marginTop: spacing.sm },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  loadingText: { fontSize: 14, color: colors.textSecondary },
  emptyText: { fontSize: 14, color: colors.textSecondary },
  readingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  readingDate: { fontSize: 13, color: colors.textSecondary },
  verifiedBadge: { fontSize: 11, color: colors.rangeNormal, fontWeight: '600', marginTop: 2 },
  confirmBadge: { fontSize: 11, color: '#F4B400', fontWeight: '600', marginTop: 2 },
  readingValue: { fontSize: 15, fontWeight: '600', marginRight: spacing.sm },
  deleteBtn: { padding: spacing.xs },
  deleteBtnText: { fontSize: 14, color: colors.textSecondary },
  modalTitle: { fontSize: 22, fontWeight: '700', color: colors.primary, marginBottom: spacing.lg, marginTop: spacing.xl },
});
