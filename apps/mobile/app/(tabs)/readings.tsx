import { formatRange, PARAMETER_SEED, PANELS } from '@medical-tracker/parameter-catalog';
import {
  FamilyLinkStatus,
  RangeFlag,
  type FamilyMemberView,
  type ParameterReading,
} from '@medical-tracker/shared-types';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from 'react-native';

import {
  AppScroll,
  Button,
  Card,
  EmptyState,
  IconButton,
  ListIcon,
  Pill,
  Row,
  SearchField,
  SelectablePill,
  TopBar,
  typography,
} from '../../src/components/healthfolio';
import { listFamilyMembers, listReadings } from '../../src/lib/api/endpoints';
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
const PANEL_LABELS: Record<string, string> = {
  [PANELS.CBC]: 'CBC',
  [PANELS.LIPID]: 'Lipids',
  [PANELS.DIABETES]: 'Diabetes',
  [PANELS.THYROID]: 'Thyroid',
};

type ProfileOption = {
  id: string | null;
  name: string;
};

function buildProfileOptions(members: FamilyMemberView[] | undefined): ProfileOption[] {
  const managedProfiles =
    members
      ?.filter((member) => member.link.status === FamilyLinkStatus.Active)
      .map((member) => ({
        id: member.link.memberUserId,
        name: member.memberName,
      })) ?? [];

  return [{ id: null, name: 'Me' }, ...managedProfiles];
}

export default function ReadingsScreen() {
  const { activeProfileId, setActiveProfile } = useProfileStore();
  const [query, setQuery] = useState('');
  const [selectedPanel, setSelectedPanel] = useState<string>('all');
  const { data: members } = useQuery({
    queryKey: ['family', 'members'],
    queryFn: listFamilyMembers,
  });
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['readings', activeProfileId],
    queryFn: () =>
      listReadings({ limit: 200, ...(activeProfileId ? { profileId: activeProfileId } : {}) }),
  });

  const profileOptions = useMemo(() => buildProfileOptions(members), [members]);
  const hasManagedProfiles = profileOptions.length > 1;
  const latest = buildLatestMap(data?.items ?? []);
  const latestReadings = Array.from(latest.values());
  const searchTerm = query.trim().toLowerCase();
  const availablePanels = PANEL_ORDER.filter((panel) =>
    PARAMETER_SEED.some((param) => param.panel === panel && latest.has(param.id)),
  );
  const attentionTotal = latestReadings.filter((reading) => {
    const flag = reading.rangeFlag as RangeFlag;
    return flag !== RangeFlag.Normal && flag !== RangeFlag.Unknown;
  }).length;
  const verifiedTotal = latestReadings.filter((reading) => reading.isUserVerified).length;

  const panelSections = useMemo(() => {
    return availablePanels.flatMap((panel) => {
      if (selectedPanel !== 'all' && selectedPanel !== panel) return [];

      const chipLabel = PANEL_LABELS[panel] ?? panel;
      const paramsWithData = PARAMETER_SEED.filter(
        (param) => param.panel === panel && latest.has(param.id),
      );
      const panelMatchesSearch =
        !searchTerm || `${panel} ${chipLabel}`.toLowerCase().includes(searchTerm);
      const visibleParams = panelMatchesSearch
        ? paramsWithData
        : paramsWithData.filter((param) =>
            [param.canonicalName, param.id, param.aliases.join(' '), chipLabel, panel]
              .join(' ')
              .toLowerCase()
              .includes(searchTerm),
          );

      if (visibleParams.length === 0) return [];

      const attention = visibleParams.filter((param) => {
        const flag = latest.get(param.id)?.rangeFlag;
        return flag && flag !== RangeFlag.Normal && flag !== RangeFlag.Unknown;
      }).length;

      return [
        {
          panel,
          attention,
          params: visibleParams,
        },
      ];
    });
  }, [availablePanels, latest, searchTerm, selectedPanel]);

  return (
    <AppScroll
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
    >
      <TopBar
        title="Trends"
        action={
          <IconButton
            icon="plus"
            label="Add report"
            onPress={() => router.push('/documents/new')}
            style={styles.addButton}
          />
        }
      />
      {hasManagedProfiles ? (
        <View style={styles.profileChips}>
          {profileOptions.map((profile) => (
            <SelectablePill
              key={profile.id ?? 'me'}
              label={profile.name}
              selected={activeProfileId === profile.id}
              onPress={() => setActiveProfile(profile.id, profile.id ? profile.name : null)}
              tone="active"
            />
          ))}
        </View>
      ) : null}
      {latest.size > 0 ? (
        <View style={styles.metaRail}>
          <ReadingMeta label={`${availablePanels.length}/8 panels`} tone="violet" />
          <ReadingMeta
            label={`${attentionTotal} watch`}
            tone={attentionTotal > 0 ? 'amber' : 'green'}
          />
          <ReadingMeta label={`${verifiedTotal} verified`} tone="green" />
        </View>
      ) : null}
      <SearchField value={query} onChangeText={setQuery} placeholder="Search biomarkers" />
      <View style={styles.chips}>
        <SelectablePill
          label="All"
          selected={selectedPanel === 'all'}
          onPress={() => setSelectedPanel('all')}
          tone="active"
        />
        {availablePanels.map((panel) => (
          <SelectablePill
            key={panel}
            label={PANEL_LABELS[panel] ?? panel}
            selected={selectedPanel === panel}
            onPress={() => setSelectedPanel(panel)}
            tone="active"
          />
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : latest.size === 0 ? (
        <Card>
          <EmptyState
            icon="activity"
            title={
              hasManagedProfiles && activeProfileId === null ? 'Choose a profile' : 'No readings'
            }
            body={
              hasManagedProfiles && activeProfileId === null
                ? 'Select a profile above.'
                : 'Upload a report.'
            }
            action={<Button label="Upload" onPress={() => router.push('/documents/new')} />}
          />
        </Card>
      ) : panelSections.length === 0 ? (
        <Card>
          <EmptyState
            icon="search"
            title="No matching readings"
            body="Try another panel or marker."
          />
        </Card>
      ) : (
        panelSections.map((section) => {
          return (
            <Card key={section.panel} style={styles.panelCard}>
              <View style={styles.panelHeader}>
                <Text style={typography.h3}>{section.panel}</Text>
                {section.attention > 0 ? (
                  <Pill label={`${section.attention} attention`} tone="amber" />
                ) : (
                  <Pill label="Stable" tone="green" />
                )}
              </View>
              {section.params.map((param) => {
                const reading = latest.get(param.id);
                return (
                  <Row
                    key={param.id}
                    left={<ListIcon icon="activity" />}
                    title={param.canonicalName}
                    subtitle={
                      reading
                        ? `${reading.value} ${reading.unit} - ${formatRange(param)}`
                        : formatRange(param)
                    }
                    right={
                      <Pill
                        label={reading?.rangeFlag ?? 'unknown'}
                        tone={flagTone(reading?.rangeFlag as RangeFlag | undefined)}
                      />
                    }
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

function ReadingMeta({ label, tone }: { label: string; tone: 'green' | 'amber' | 'violet' }) {
  const toneStyle = {
    green: styles.metaDotGreen,
    amber: styles.metaDotAmber,
    violet: styles.metaDotViolet,
  }[tone];

  return (
    <View style={styles.metaItem}>
      <View style={[styles.metaDot, toneStyle]} />
      <Text style={styles.metaText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: { width: 48, height: 48, borderRadius: 24 },
  profileChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  metaRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: 2,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaDot: { width: 7, height: 7, borderRadius: 4 },
  metaDotGreen: { backgroundColor: colors.secondary },
  metaDotAmber: { backgroundColor: colors.amber },
  metaDotViolet: { backgroundColor: colors.secondary },
  metaText: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  panelCard: { paddingTop: spacing.sm, paddingBottom: spacing.sm },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
});
