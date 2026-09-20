import { Feather } from '@expo/vector-icons';
import { PARAMETER_SEED } from '@medical-tracker/parameter-catalog';
import {
  DocType,
  OcrStatus,
  RangeFlag,
  type ParameterReading,
} from '@medical-tracker/shared-types';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, type ComponentProps } from 'react';
import { Alert, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import {
  AppScroll,
  Button,
  Card,
  LoadingScreen,
  Pill,
  ProfilePill,
  Row,
  SectionHeader,
  TopBar,
} from '../../src/components/healthfolio';
import { getMe, listDocuments, listReadings } from '../../src/lib/api/endpoints';
import { useProfileStore } from '../../src/lib/profile/profileStore';
import { colors, radius, spacing } from '../../src/theme/tokens';

const DOC_TYPE_LABELS: Record<DocType, string> = {
  [DocType.LabReport]: 'Blood work',
  [DocType.Prescription]: 'Prescription',
  [DocType.ImagingReport]: 'X-ray / CT / MRI',
  [DocType.DischargeSummary]: 'Surgery',
  [DocType.VaccinationRecord]: 'Vaccine',
  [DocType.Other]: 'Document',
};

type FeatherName = ComponentProps<typeof Feather>['name'];

type ScorePart = {
  key: string;
  icon: FeatherName;
  label: string;
  value: string;
  points: number;
  max: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function pickAbnormal(readings: ParameterReading[]): ParameterReading[] {
  return readings
    .filter((r) => r.rangeFlag !== RangeFlag.Normal && r.rangeFlag !== RangeFlag.Unknown)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
    .slice(0, 3);
}

function panelCount(readings: ParameterReading[]): number {
  const panels = new Set<string>();
  for (const reading of readings) {
    const entry = PARAMETER_SEED.find((param) => param.id === reading.parameterId);
    if (entry) panels.add(entry.panel);
  }
  return panels.size;
}

function latestReadingsByParameter(readings: ParameterReading[]): ParameterReading[] {
  const latest = new Map<string, ParameterReading>();
  for (const reading of readings) {
    const existing = latest.get(reading.parameterId);
    if (!existing || reading.recordedAt > existing.recordedAt) {
      latest.set(reading.parameterId, reading);
    }
  }
  return Array.from(latest.values());
}

function profileAgeYears(dob?: string | null): number | null {
  if (!dob) return null;
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return null;
  const years = Math.floor((Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  if (years < 0 || years > 125) return null;
  return years;
}

function rangeWeight(flag: RangeFlag): number {
  if (flag === RangeFlag.Normal) return 1;
  if (flag === RangeFlag.High || flag === RangeFlag.Low) return 0.52;
  if (flag === RangeFlag.Critical) return 0.18;
  return 0.72;
}

function healthScoreBreakdown({
  documents,
  readings,
  panels,
  readyForReview,
  ageYears,
}: {
  documents: number;
  readings: ParameterReading[];
  panels: number;
  readyForReview: number;
  ageYears: number | null;
}): {
  total: number;
  parts: ScorePart[];
  ageLabel: string;
  flaggedLatest: number;
  rangedLatest: number;
  reviewPenalty: number;
  trustPercent: number;
} {
  const latest = latestReadingsByParameter(readings);
  const ranged = latest.filter((reading) => reading.rangeFlag !== RangeFlag.Unknown);
  const flaggedLatest = ranged.filter((reading) => reading.rangeFlag !== RangeFlag.Normal).length;
  const markerAverage =
    ranged.length > 0
      ? ranged.reduce((sum, reading) => sum + rangeWeight(reading.rangeFlag as RangeFlag), 0) /
        ranged.length
      : 0.35;
  const trustAverage =
    latest.length > 0
      ? latest.reduce((sum, reading) => sum + clamp(reading.confidenceScore, 0, 1), 0) /
        latest.length
      : 0.65;
  const markerPoints = Math.round(markerAverage * 55);
  const evidencePoints =
    Math.round((Math.min(documents, 6) / 6) * 14) +
    Math.round((Math.min(latest.length, 12) / 12) * 6);
  const panelPoints = Math.round((Math.min(panels, 8) / 8) * 10);
  const trustPoints = Math.round(trustAverage * 10);
  const profilePoints = ageYears !== null ? 5 : 0;
  const reviewPenalty = Math.min(12, readyForReview * 3);
  const total = clamp(
    markerPoints + evidencePoints + panelPoints + trustPoints + profilePoints - reviewPenalty,
    0,
    100,
  );

  return {
    total,
    ageLabel: ageYears !== null ? `${ageYears} years` : 'profile ranges where available',
    flaggedLatest,
    rangedLatest: ranged.length,
    reviewPenalty,
    trustPercent: Math.round(trustAverage * 100),
    parts: [
      {
        key: 'markers',
        icon: 'file-text',
        label: 'Marker status',
        value:
          ranged.length > 0
            ? `${ranged.length - flaggedLatest}/${ranged.length} in range`
            : 'No ranges',
        points: markerPoints,
        max: 55,
      },
      {
        key: 'evidence',
        icon: 'check-circle',
        label: 'Record depth',
        value: `${documents} docs, ${latest.length} markers`,
        points: evidencePoints,
        max: 20,
      },
      {
        key: 'panels',
        icon: 'activity',
        label: 'Panels',
        value: `${Math.min(panels, 8)}/8`,
        points: panelPoints,
        max: 10,
      },
      {
        key: 'trust',
        icon: 'alert-circle',
        label: 'OCR trust',
        value: `${Math.round(trustAverage * 100)}%`,
        points: trustPoints,
        max: 10,
      },
      {
        key: 'profile',
        icon: 'user',
        label: 'Age context',
        value: ageYears !== null ? `${ageYears}y` : 'Not set',
        points: profilePoints,
        max: 5,
      },
    ],
  };
}

function latestDocumentTitle(docType: DocType, labName?: string | null): string {
  return labName?.trim() || DOC_TYPE_LABELS[docType] || 'Document';
}

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function lastSevenDays(): string[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return dateKey(date);
  });
}

export default function HomeScreen() {
  const { activeProfileId, activeProfileName } = useProfileStore();
  const { data: me, isLoading: loadingMe } = useQuery({ queryKey: ['me'], queryFn: getMe });
  const {
    data: readings,
    isLoading: loadingReadings,
    refetch: refetchReadings,
    isRefetching,
  } = useQuery({
    queryKey: ['readings', activeProfileId],
    queryFn: () =>
      listReadings({ limit: 200, ...(activeProfileId ? { profileId: activeProfileId } : {}) }),
  });
  const { data: docs, refetch: refetchDocs } = useQuery({
    queryKey: ['documents', activeProfileId],
    queryFn: () =>
      listDocuments({ limit: 30, ...(activeProfileId ? { profileId: activeProfileId } : {}) }),
  });

  const onRefresh = useCallback(() => {
    void refetchReadings();
    void refetchDocs();
  }, [refetchDocs, refetchReadings]);

  if (loadingMe || loadingReadings) {
    return <LoadingScreen />;
  }

  const name = me?.user.name?.trim();
  const firstName = activeProfileName ?? (name ? name.split(' ')[0] : 'there');
  const allReadings = readings?.items ?? [];
  const allDocs = docs?.items ?? [];
  const readyDocs = allDocs.filter((doc) => doc.ocrStatus === OcrStatus.ReadyForReview);
  const processingDocs = allDocs.filter(
    (doc) => doc.ocrStatus === OcrStatus.Queued || doc.ocrStatus === OcrStatus.Processing,
  );
  const abnormal = pickAbnormal(allReadings);
  const currentPanels = panelCount(allReadings);
  const ageYears = activeProfileId ? null : profileAgeYears(me?.user.dob);
  const healthScore = healthScoreBreakdown({
    documents: allDocs.length,
    readings: allReadings,
    panels: currentPanels,
    readyForReview: readyDocs.length,
    ageYears,
  });
  const score = healthScore.total;
  const recentDoc = allDocs[0];
  const timeline = lastSevenDays().map((day) => {
    const documents = allDocs.filter((doc) => doc.sourceDate.slice(0, 10) === day).length;
    const markers = allReadings.filter((reading) => reading.recordedAt.slice(0, 10) === day).length;
    return { day, documents, markers, total: documents + markers };
  });

  const nextAction =
    readyDocs.length > 0
      ? {
          icon: 'alert-circle' as FeatherName,
          title: `Review ${readyDocs.length} ${readyDocs.length === 1 ? 'record' : 'records'}`,
          subtitle: 'Confirm extracted values.',
          tone: 'amber' as const,
          action: () => router.push('/(tabs)/documents'),
        }
      : processingDocs.length > 0
        ? {
            icon: 'activity' as FeatherName,
            title: 'OCR in progress',
            subtitle: 'Reports are being read.',
            tone: 'blue' as const,
            action: () => router.push('/(tabs)/documents'),
          }
        : {
            icon: 'upload-cloud' as FeatherName,
            title: allDocs.length > 0 ? 'Add another report' : 'Add first report',
            subtitle: 'Start your timeline.',
            tone: 'green' as const,
            action: () => router.push('/documents/new'),
          };
  const nextIconStyle = {
    green: styles.greenIcon,
    amber: styles.amberIcon,
    blue: styles.blueIcon,
  }[nextAction.tone];

  function explainHealthScore(): void {
    Alert.alert(
      'Health score',
      [
        'A records-based score using extracted markers and profile-aware reference ranges where available. It is not a diagnosis or medical risk score.',
        '',
        `Age context: ${healthScore.ageLabel}.`,
        `Marker status: ${healthScore.parts[0]?.points ?? 0}/55.`,
        `Record depth: ${healthScore.parts[1]?.points ?? 0}/20.`,
        `Panel coverage: ${healthScore.parts[2]?.points ?? 0}/10.`,
        `OCR trust: ${healthScore.parts[3]?.points ?? 0}/10.`,
        `Profile context: ${healthScore.parts[4]?.points ?? 0}/5.`,
        healthScore.reviewPenalty > 0 ? `Open review penalty: -${healthScore.reviewPenalty}.` : '',
      ].join('\n'),
    );
  }

  return (
    <AppScroll refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}>
      <TopBar
        title="Today"
        action={
          <ProfilePill
            name={activeProfileName ?? firstName ?? 'Me'}
            onPress={() => router.push('/(tabs)/profile')}
          />
        }
      />

      <View style={styles.readinessCard}>
        <View style={styles.readinessHeader}>
          <View>
            <Text style={styles.readinessLabel}>Health score</Text>
            <Text style={styles.scoreContext}>
              {ageYears !== null
                ? `Age-adjusted markers, ${ageYears}y`
                : 'Profile-adjusted markers'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={explainHealthScore}
            style={styles.scoreHint}
          >
            <Feather name="info" size={17} color={colors.secondary} />
          </Pressable>
        </View>
        <View style={styles.scoreBody}>
          <View style={styles.scoreCircle}>
            <View style={styles.scoreCircleGlow} />
            <Text style={styles.score}>{score}</Text>
            <Text style={styles.scoreSuffix}>/100</Text>
          </View>
          <View style={styles.signalStack}>
            <TechSignal label="Records" value={allDocs.length} tone="blue" />
            <TechSignal label="Markers" value={healthScore.rangedLatest} tone="green" />
            <TechSignal
              label="Flagged"
              value={healthScore.flaggedLatest + readyDocs.length}
              tone="amber"
            />
          </View>
        </View>
        <View style={styles.scoreTrack}>
          <View style={[styles.scoreFill, { width: `${score}%` }]} />
        </View>
        <Text style={styles.readinessCopy}>
          A technical health signal from your records, marker ranges, and OCR trust.
        </Text>
      </View>

      <SectionHeader icon="target" title="Next" />
      <Pressable accessibilityRole="button" onPress={nextAction.action} style={styles.nextCard}>
        <View style={[styles.nextIcon, nextIconStyle]}>
          <Feather
            name={nextAction.icon}
            size={18}
            color={nextAction.tone === 'amber' ? colors.amber : colors.primary}
          />
        </View>
        <View style={styles.nextText}>
          <Text style={styles.nextTitle}>{nextAction.title}</Text>
          <Text style={styles.nextSubtitle}>{nextAction.subtitle}</Text>
        </View>
        <Pill label={nextAction.tone === 'green' ? 'Start' : 'Open'} tone={nextAction.tone} />
      </Pressable>

      <SectionHeader icon="zap" title="Insights" />
      <Card>
        {abnormal.length > 0 ? (
          abnormal.map((reading) => (
            <InsightRow
              key={reading.id}
              tone={reading.rangeFlag === RangeFlag.Critical ? 'red' : 'amber'}
              title={`${reading.parameterId.replace(/-/g, ' ')} needs attention`}
              subtitle={new Date(reading.recordedAt).toLocaleDateString()}
              onPress={() => router.push(`/readings/${reading.parameterId}`)}
            />
          ))
        ) : recentDoc ? (
          <InsightRow
            tone="green"
            title={`${latestDocumentTitle(recentDoc.docType as DocType, recentDoc.labName)} added`}
            subtitle={new Date(recentDoc.sourceDate).toLocaleDateString()}
            onPress={() => router.push(`/documents/${recentDoc.id}`)}
          />
        ) : (
          <InsightRow
            tone="blue"
            title="Forward or upload reports"
            subtitle="Email and uploads appear here."
            onPress={() => router.push('/documents/new')}
          />
        )}
      </Card>

      <SectionHeader icon="calendar" title="7-day timeline" />
      <Card>
        <View style={styles.timelineRow}>
          {timeline.map((item) => (
            <View key={item.day} style={styles.timelineDay}>
              <View
                style={[
                  styles.timelineBar,
                  { height: 18 + Math.min(42, item.total * 8) },
                  item.total > 0 && styles.timelineBarActive,
                ]}
              />
              <Text style={styles.timelineLabel}>
                {new Date(`${item.day}T00:00:00`).toLocaleDateString(undefined, {
                  weekday: 'short',
                })}
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.timelineCopy}>Documents and biomarker readings from this week.</Text>
      </Card>

      <SectionHeader icon="grid" title="Tools" />
      <Card>
        <ToolRow
          icon="bell"
          title="Care plan"
          subtitle="Medicines, repeat tests, visits."
          onPress={() => router.push('/medications')}
        />
        <ToolRow
          icon="message-circle"
          title="Assistant"
          subtitle="Ask records-only questions."
          onPress={() => router.push('/assistant')}
        />
      </Card>

      {allDocs.length === 0 ? (
        <Button label="Upload report" onPress={() => router.push('/documents/new')} />
      ) : null}
    </AppScroll>
  );
}

function ToolRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: FeatherName;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Row
      title={title}
      subtitle={subtitle}
      left={
        <View style={styles.toolIcon}>
          <Feather name={icon} size={17} color={colors.primary} />
        </View>
      }
      right={<Feather name="chevron-right" size={18} color={colors.textMuted} />}
      onPress={onPress}
    />
  );
}

function InsightRow({
  tone,
  title,
  subtitle,
  onPress,
}: {
  tone: 'green' | 'amber' | 'red' | 'blue';
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const dotStyle = {
    green: styles.greenDot,
    amber: styles.amberDot,
    red: styles.redDot,
    blue: styles.blueDot,
  }[tone];

  return (
    <Row
      title={title}
      subtitle={subtitle}
      right={<View style={[styles.insightDot, dotStyle]} />}
      onPress={onPress}
    />
  );
}

function TechSignal({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: 'blue' | 'green' | 'amber';
}) {
  const dotStyle = {
    blue: styles.techDotBlue,
    green: styles.techDotGreen,
    amber: styles.techDotAmber,
  }[tone];

  return (
    <View style={styles.techSignal}>
      <View style={[styles.techDot, dotStyle]} />
      <View style={styles.techText}>
        <Text style={styles.techLabel}>{label}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={styles.techValue}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readinessCard: {
    overflow: 'hidden',
    borderWidth: 0,
    borderRadius: radius.hero,
    backgroundColor: colors.navy,
    padding: spacing.lg,
    marginBottom: 12,
    shadowColor: '#102533',
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
  },
  readinessHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  readinessLabel: { color: '#D7E7F1', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  scoreContext: {
    color: 'rgba(215,231,241,0.62)',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  scoreBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  scoreCircle: {
    width: 148,
    height: 148,
    borderRadius: 74,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 10,
    borderColor: colors.primary,
    backgroundColor: '#13232B',
  },
  scoreCircleGlow: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: 'rgba(22,141,255,0.16)',
  },
  score: { color: '#FFFFFF', fontSize: 50, lineHeight: 55, fontWeight: '700' },
  scoreSuffix: {
    color: colors.secondary,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
  },
  scoreHint: {
    width: 36,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  scoreTrack: {
    height: 8,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginTop: spacing.lg,
  },
  scoreFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.secondary },
  signalStack: { flex: 1, gap: spacing.sm },
  techSignal: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  techDot: { width: 9, height: 9, borderRadius: 5 },
  techDotBlue: { backgroundColor: colors.primary },
  techDotGreen: { backgroundColor: colors.secondary },
  techDotAmber: { backgroundColor: colors.amber },
  techText: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  techLabel: { color: 'rgba(215,231,241,0.72)', fontSize: 11, lineHeight: 15, fontWeight: '700' },
  techValue: { color: '#FFFFFF', fontSize: 16, lineHeight: 20, fontWeight: '700' },
  readinessCopy: {
    color: 'rgba(215,231,241,0.66)',
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing.sm,
  },
  nextCard: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 0,
    borderRadius: 24,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md,
    marginBottom: 14,
  },
  nextIcon: {
    width: 44,
    height: 44,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greenIcon: { backgroundColor: colors.greenBg },
  amberIcon: { backgroundColor: colors.amberBg },
  blueIcon: { backgroundColor: colors.blueBg },
  nextText: { flex: 1 },
  nextTitle: { color: colors.textPrimary, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  nextSubtitle: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
  insightDot: { width: 10, height: 10, borderRadius: 5 },
  greenDot: { backgroundColor: colors.secondary },
  amberDot: { backgroundColor: colors.amber },
  redDot: { backgroundColor: colors.danger },
  blueDot: { backgroundColor: colors.primaryDark },
  timelineRow: {
    height: 92,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  timelineDay: { flex: 1, alignItems: 'center', gap: 7 },
  timelineBar: {
    width: '70%',
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  timelineBarActive: { backgroundColor: colors.primary },
  timelineLabel: { color: colors.textSecondary, fontSize: 10, lineHeight: 13, fontWeight: '700' },
  timelineCopy: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing.md,
  },
  toolIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryBg,
  },
});
