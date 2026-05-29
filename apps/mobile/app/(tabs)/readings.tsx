import { PARAMETER_SEED, PANELS } from '@medical-tracker/parameter-catalog';
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
  const { activeProfileId, activeProfileName, setActiveProfile } = useProfileStore();
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
  const searchTerm = query.trim().toLowerCase();
  const availablePanels = PANEL_ORDER.filter((panel) =>
    PARAMETER_SEED.some((param) => param.panel === panel && latest.has(param.id)),
  );

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
        eyebrow={
          activeProfileName ? `Confirmed history: ${activeProfileName}` : 'Confirmed history'
        }
        title="Readings"
        action={
          <Button
            label="Add"
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
      <SearchField value={query} onChangeText={setQuery} placeholder="Search parameter or panel" />
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
              hasManagedProfiles && activeProfileId === null
                ? 'Choose a profile'
                : 'No readings yet'
            }
            body={
              hasManagedProfiles && activeProfileId === null
                ? 'Reports were added to managed profiles. Select a profile above to view its readings.'
                : 'Upload a lab report to extract readings and build your trend history.'
            }
            action={
              <Button label="Upload document" onPress={() => router.push('/documents/new')} />
            }
          />
        </Card>
      ) : panelSections.length === 0 ? (
        <Card>
          <EmptyState
            icon="search"
            title="No matching readings"
            body="Try another panel name or parameter term."
          />
        </Card>
      ) : (
        panelSections.map((section) => {
          return (
            <Card key={section.panel}>
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
                    title={param.canonicalName}
                    subtitle={reading ? `Latest ${reading.value} ${reading.unit}` : param.unit}
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

const styles = StyleSheet.create({
  addButton: { minWidth: 78, minHeight: 38, marginTop: 0, paddingHorizontal: spacing.md },
  profileChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
});
