import { findById, formatRange } from '@medical-tracker/parameter-catalog';
import { RangeFlag, ReadingStatus, type TrendResponse } from '@medical-tracker/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

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
import { createReading, deleteReading, getTrend, patchReading } from '../../src/lib/api/endpoints';
import { colors, spacing } from '../../src/theme/tokens';

function flagTone(flag?: RangeFlag): 'green' | 'amber' | 'red' | 'neutral' {
  if (!flag || flag === RangeFlag.Unknown) return 'neutral';
  if (flag === RangeFlag.Normal) return 'green';
  if (flag === RangeFlag.Critical) return 'red';
  return 'amber';
}

function trendArrow(data: TrendResponse['data']): string {
  if (data.length < 2) return '';
  const last = data[data.length - 1]?.value;
  const prev = data[data.length - 2]?.value;
  if (last === undefined || prev === undefined) return '';
  if (last > prev * 1.02) return 'up';
  if (last < prev * 0.98) return 'down';
  return 'stable';
}

function isDateInput(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export default function ParameterHistoryScreen() {
  const { parameterId } = useLocalSearchParams<{ parameterId: string }>();
  const qc = useQueryClient();
  const entry = findById(parameterId);
  const [adding, setAdding] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [newDate, setNewDate] = useState('');
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
      setNewDate('');
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => patchReading(id, { status: ReadingStatus.Confirmed, isUserVerified: true }),
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
      <CenteredScreen>
        <Text style={styles.error}>Unknown parameter.</Text>
      </CenteredScreen>
    );
  }
  if (isLoading) return <LoadingScreen />;

  const data = trend?.data ?? [];
  const latest = data[data.length - 1];
  const rangeLabel = formatRange(entry);
  const canSaveReading = !!newValue && !Number.isNaN(parseFloat(newValue)) && isDateInput(newDate);

  return (
    <AppScroll>
      <TopBar
        eyebrow={entry.panel}
        title={entry.canonicalName}
        action={latest ? <Pill label={latest.rangeFlag} tone={flagTone(latest.rangeFlag)} /> : undefined}
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
        <Text style={typography.h3}>Trend</Text>
        <TrendBars data={data} />
        <Text style={typography.bodySmall}>Direction: {trendArrow(data) || 'not enough data'}</Text>
      </Card>

      <Card>
        <View style={styles.historyHeader}>
          <Text style={typography.h3}>History</Text>
          <Button label="Add" variant="secondary" onPress={() => setAdding(true)} style={styles.addButton} />
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
            <TextField label="Unit" value={newUnit} onChangeText={setNewUnit} placeholder={entry.unit} />
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

function TrendBars({ data }: { data: TrendResponse['data'] }) {
  if (data.length < 2) {
    return <Text style={[typography.body, { marginTop: spacing.sm }]}>At least two readings are needed for a trend.</Text>;
  }
  const values = data.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return (
    <View style={styles.chart}>
      {data.map((point) => {
        const height = ((point.value - min) / range) * 0.65 + 0.2;
        const tone = flagTone(point.rangeFlag);
        const color = tone === 'green' ? colors.rangeNormal : tone === 'red' ? colors.danger : tone === 'amber' ? colors.amber : colors.textSecondary;
        return (
          <View key={point.readingId} style={styles.barWrap}>
            <View style={[styles.bar, { height: `${height * 100}%`, backgroundColor: color }]} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger, fontSize: 16 },
  latest: { color: colors.textPrimary, fontSize: 24, lineHeight: 30, fontWeight: '800', marginVertical: spacing.xs },
  chart: { height: 145, flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: spacing.md, marginBottom: spacing.sm },
  barWrap: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { borderRadius: 8, minHeight: 8 },
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addButton: { width: 72, marginTop: 0 },
  historyRight: { alignItems: 'flex-end', gap: 4 },
  confirmText: { color: colors.amber, fontSize: 11, fontWeight: '800' },
  deleteText: { color: colors.textSecondary, fontSize: 11, fontWeight: '800' },
});
