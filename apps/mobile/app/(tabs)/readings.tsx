import { PARAMETER_SEED, PANELS } from '@medical-tracker/parameter-catalog';
import { RangeFlag, type ParameterReading } from '@medical-tracker/shared-types';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ProfileSwitcher } from '../../src/components/ProfileSwitcher';
import { listReadings } from '../../src/lib/api/endpoints';
import { useProfileStore } from '../../src/lib/profile/profileStore';
import { colors, radius, spacing } from '../../src/theme/tokens';

const FLAG_COLORS: Record<RangeFlag, string> = {
  [RangeFlag.Normal]: colors.rangeNormal,
  [RangeFlag.Low]: colors.rangeLow,
  [RangeFlag.High]: colors.rangeHigh,
  [RangeFlag.Critical]: colors.rangeCritical,
  [RangeFlag.Unknown]: colors.textSecondary,
};

/** Pick the most-recent reading for each parameterId from a flat list. */
function buildLatestMap(readings: ParameterReading[]): Map<string, ParameterReading> {
  const map = new Map<string, ParameterReading>();
  for (const r of readings) {
    const existing = map.get(r.parameterId);
    if (!existing || r.recordedAt > existing.recordedAt) {
      map.set(r.parameterId, r);
    }
  }
  return map;
}

/** All unique panel labels in seed order. */
const PANEL_ORDER = Object.values(PANELS);

export default function ReadingsScreen() {
  const { activeProfileId } = useProfileStore();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['readings', activeProfileId],
    queryFn: () =>
      listReadings({
        limit: 200,
        ...(activeProfileId ? { profileId: activeProfileId } : {}),
      }),
  });

  const latest = buildLatestMap(data?.items ?? []);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ProfileSwitcher />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
      >
        {PANEL_ORDER.map((panel) => {
          const params = PARAMETER_SEED.filter((p) => p.panel === panel);
          if (params.length === 0) return null;
          return (
            <View key={panel} style={styles.panel}>
              <Text style={styles.panelTitle}>{panel}</Text>
              {params.map((param) => {
                const reading = latest.get(param.id);
                const flagColor = reading
                  ? (FLAG_COLORS[reading.rangeFlag as RangeFlag] ?? colors.textSecondary)
                  : colors.border;
                return (
                  <Pressable
                    key={param.id}
                    style={styles.row}
                    accessibilityRole="button"
                    onPress={() => router.push(`/readings/${param.id}`)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.paramName}>{param.canonicalName}</Text>
                      <Text style={styles.paramUnit}>{param.unit}</Text>
                    </View>
                    <View style={styles.valueCol}>
                      {reading ? (
                        <>
                          <Text style={[styles.value, { color: flagColor }]}>
                            {reading.value} {reading.unit}
                          </Text>
                          <Text style={[styles.flag, { color: flagColor }]}>
                            {reading.rangeFlag.toUpperCase()}
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.dash}>—</Text>
                      )}
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  panelTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  paramName: { fontSize: 14, color: colors.textPrimary, fontWeight: '500' },
  paramUnit: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  valueCol: { alignItems: 'flex-end', marginRight: spacing.sm },
  value: { fontSize: 14, fontWeight: '600' },
  flag: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  dash: { fontSize: 16, color: colors.border },
  chevron: { fontSize: 18, color: colors.textSecondary, marginLeft: spacing.xs },
});
