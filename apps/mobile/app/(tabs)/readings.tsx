import { PARAMETER_SEED, PANELS } from '@medical-tracker/parameter-catalog';
import { RangeFlag, type ParameterReading } from '@medical-tracker/shared-types';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppScroll, Button, Card, EmptyState, Pill, Row, TopBar, typography } from '../../src/components/healthfolio';
import { listReadings } from '../../src/lib/api/endpoints';
import { useProfileStore } from '../../src/lib/profile/profileStore';
import { colors, spacing } from '../../src/theme/tokens';

function buildLatestMap(readings: ParameterReading[]): Map<string, ParameterReading> {
  const map = new Map<string, ParameterReading>();
  for (const reading of readings) {
    const existing = map.get(reading.parameterId);
    if (!existing || reading.recordedAt > existing.recordedAt) {
      map.set(reading.parameterId, reading);
    }
  }
  return map;
}

function flagTone(flag?: RangeFlag): 'green' | 'amber' | 'red' | 'neutral' {
  if (!flag || flag === RangeFlag.Unknown) return 'neutral';
  if (flag === RangeFlag.Normal) return 'green';
  if (flag === RangeFlag.Critical) return 'red';
  return 'amber';
}

const PANEL_ORDER = Object.values(PANELS);

export default function ReadingsScreen() {
  const { activeProfileId } = useProfileStore();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['readings', activeProfileId],
    queryFn: () => listReadings({ limit: 200, ...(activeProfileId ? { profileId: activeProfileId } : {}) }),
  });

  const latest = buildLatestMap(data?.items ?? []);

  return (
    <AppScroll
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
    >
      <TopBar
        eyebrow="Confirmed history"
        title="Readings"
        action={<Button label="Add" onPress={() => router.push('/documents/new')} style={styles.addButton} />}
      />
      <TextInput
        editable={false}
        placeholder="Search parameter or panel"
        placeholderTextColor={colors.textSecondary}
        style={styles.search}
      />
      <View style={styles.chips}>
        <Pill label="All" tone="active" />
        <Pill label="CBC" />
        <Pill label="Lipids" />
        <Pill label="Diabetes" />
        <Pill label="Thyroid" />
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : latest.size === 0 ? (
        <Card>
          <EmptyState
            icon="activity"
            title="No readings yet"
            body="Upload a lab report to extract readings and build your trend history."
            action={<Button label="Upload document" onPress={() => router.push('/documents/new')} />}
          />
        </Card>
      ) : (
        PANEL_ORDER.map((panel) => {
          const params = PARAMETER_SEED.filter((p) => p.panel === panel);
          const paramsWithData = params.filter((param) => latest.has(param.id));
          if (paramsWithData.length === 0) return null;
          const attention = paramsWithData.filter((param) => {
            const flag = latest.get(param.id)?.rangeFlag;
            return flag && flag !== RangeFlag.Normal && flag !== RangeFlag.Unknown;
          }).length;
          return (
            <Card key={panel}>
              <View style={styles.panelHeader}>
                <Text style={typography.h3}>{panel}</Text>
                {attention > 0 ? <Pill label={`${attention} attention`} tone="amber" /> : <Pill label="Stable" tone="green" />}
              </View>
              {paramsWithData.map((param) => {
                const reading = latest.get(param.id);
                return (
                  <Row
                    key={param.id}
                    title={param.canonicalName}
                    subtitle={reading ? `Latest ${reading.value} ${reading.unit}` : param.unit}
                    right={<Pill label={reading?.rangeFlag ?? 'unknown'} tone={flagTone(reading?.rangeFlag as RangeFlag | undefined)} />}
                    onPress={() => router.push(`/readings/${param.id}`)}
                  />
                );
              })}
            </Card>
          );
        })
      )}
    </AppScroll>
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
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
});
