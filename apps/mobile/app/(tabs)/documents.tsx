import {
  DocType,
  FamilyLinkStatus,
  OcrStatus,
  type DocumentSummary,
  type FamilyMemberView,
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
} from '../../src/components/healthfolio';
import { listDocuments, listFamilyMembers } from '../../src/lib/api/endpoints';
import { useProfileStore } from '../../src/lib/profile/profileStore';
import { colors, spacing } from '../../src/theme/tokens';

const DOC_TYPE_LABELS: Record<DocType, string> = {
  [DocType.LabReport]: 'Blood work',
  [DocType.Prescription]: 'Prescription',
  [DocType.ImagingReport]: 'X-ray / CT / MRI',
  [DocType.DischargeSummary]: 'Surgery',
  [DocType.VaccinationRecord]: 'Vaccine',
  [DocType.Other]: 'Document',
};

const STATUS_LABELS: Record<OcrStatus, string> = {
  [OcrStatus.PendingUpload]: 'Pending',
  [OcrStatus.Queued]: 'Queued',
  [OcrStatus.Processing]: 'Processing',
  [OcrStatus.ReadyForReview]: 'Ready',
  [OcrStatus.Failed]: 'Failed',
};

function statusTone(status: OcrStatus): 'green' | 'amber' | 'blue' | 'red' | 'neutral' {
  if (status === OcrStatus.ReadyForReview) return 'green';
  if (status === OcrStatus.Failed) return 'red';
  if (status === OcrStatus.Queued || status === OcrStatus.Processing) return 'blue';
  if (status === OcrStatus.PendingUpload) return 'neutral';
  return 'green';
}

type DocumentFilter = 'all' | 'ready' | 'progress' | 'failed';
type CategoryFilter = 'all' | DocType;

const FILTER_OPTIONS: ReadonlyArray<{
  label: string;
  value: DocumentFilter;
  tone: 'active' | 'green' | 'blue' | 'red';
}> = [
  { label: 'All', value: 'all', tone: 'active' },
  { label: 'Ready', value: 'ready', tone: 'green' },
  { label: 'In progress', value: 'progress', tone: 'blue' },
  { label: 'Failed', value: 'failed', tone: 'red' },
];

const CATEGORY_OPTIONS: ReadonlyArray<{
  label: string;
  value: CategoryFilter;
  tone: 'active' | 'amber' | 'blue' | 'green' | 'neutral';
}> = [
  { label: 'All', value: 'all', tone: 'active' },
  { label: 'Blood', value: DocType.LabReport, tone: 'blue' },
  { label: 'Rx', value: DocType.Prescription, tone: 'green' },
  { label: 'Imaging', value: DocType.ImagingReport, tone: 'blue' },
  { label: 'Surgery', value: DocType.DischargeSummary, tone: 'neutral' },
  { label: 'Vaccines', value: DocType.VaccinationRecord, tone: 'neutral' },
  { label: 'Other', value: DocType.Other, tone: 'neutral' },
];

function matchesFilter(status: OcrStatus, filter: DocumentFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'ready') return status === OcrStatus.ReadyForReview;
  if (filter === 'progress') return status === OcrStatus.Queued || status === OcrStatus.Processing;
  return status === OcrStatus.Failed;
}

function matchesCategory(docType: DocType, filter: CategoryFilter): boolean {
  return filter === 'all' || docType === filter;
}

function toSearchableText(item: DocumentSummary): string {
  return [
    documentTitle(item),
    DOC_TYPE_LABELS[item.docType as DocType] ?? item.docType,
    item.labName ?? '',
    item.notes ?? '',
    item.sourceDate,
    new Date(item.sourceDate).toLocaleDateString(),
    STATUS_LABELS[item.ocrStatus as OcrStatus] ?? item.ocrStatus,
  ]
    .join(' ')
    .toLowerCase();
}

function forwardedFilename(notes?: string | null): string | null {
  const match = notes?.match(/^Forwarded email attachment:\s*(.+)$/im);
  return match?.[1]?.trim() || null;
}

function forwardedSubject(notes?: string | null): string | null {
  const match = notes?.match(/^Subject:\s*(.+)$/im);
  return match?.[1]?.trim() || null;
}

function isGenericDocumentName(value?: string | null): boolean {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return false;
  return /^(file|attachment|document|scan|report|pdf)([-_\s]?\d+)?\.(pdf|png|jpe?g)$/i.test(
    normalized,
  );
}

function documentTitle(item: DocumentSummary): string {
  const subject = forwardedSubject(item.notes);
  if (subject && isGenericDocumentName(item.labName ?? forwardedFilename(item.notes))) {
    return subject;
  }

  return (
    item.labName?.trim() ||
    forwardedFilename(item.notes) ||
    (item.docType === DocType.Other ? 'Forwarded document' : DOC_TYPE_LABELS[item.docType])
  );
}

function documentSubtitle(item: DocumentSummary): string {
  const sourceDate = new Date(item.sourceDate).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${DOC_TYPE_LABELS[item.docType as DocType] ?? 'Document'} - ${sourceDate}`;
}

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

export default function DocumentsScreen() {
  const { activeProfileId, setActiveProfile } = useProfileStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DocumentFilter>('all');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const { data: members } = useQuery({
    queryKey: ['family', 'members'],
    queryFn: listFamilyMembers,
  });
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['documents', activeProfileId],
    queryFn: () =>
      listDocuments({ ...(activeProfileId ? { profileId: activeProfileId } : {}), limit: 100 }),
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? [];
      return items.some(
        (doc) => doc.ocrStatus === OcrStatus.Queued || doc.ocrStatus === OcrStatus.Processing,
      )
        ? 3000
        : false;
    },
    refetchOnMount: 'always',
    refetchOnReconnect: 'always',
  });

  const profileOptions = useMemo(() => buildProfileOptions(members), [members]);
  const hasManagedProfiles = profileOptions.length > 1;
  const docs = data?.items ?? [];
  const readyCount = docs.filter((doc) => doc.ocrStatus === OcrStatus.ReadyForReview).length;
  const inProgressCount = docs.filter(
    (doc) => doc.ocrStatus === OcrStatus.Queued || doc.ocrStatus === OcrStatus.Processing,
  ).length;
  const failedCount = docs.filter((doc) => doc.ocrStatus === OcrStatus.Failed).length;
  const pendingCount = docs.filter((doc) => doc.ocrStatus === OcrStatus.PendingUpload).length;

  const filteredDocs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return docs.filter((item) => {
      if (!matchesFilter(item.ocrStatus as OcrStatus, filter)) return false;
      if (!matchesCategory(item.docType as DocType, category)) return false;
      if (!normalizedQuery) return true;
      return toSearchableText(item).includes(normalizedQuery);
    });
  }, [category, docs, filter, query]);

  return (
    <AppScroll
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
    >
      <TopBar
        title="Records"
        action={
          <IconButton
            icon="plus"
            label="Add record"
            onPress={() => router.push('/documents/new')}
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

      <SearchField value={query} onChangeText={setQuery} placeholder="Search records" />

      <View style={styles.categoryChips}>
        {CATEGORY_OPTIONS.map((option) => (
          <SelectablePill
            key={option.value}
            label={option.label}
            selected={category === option.value}
            onPress={() => setCategory(option.value)}
            tone={option.tone}
          />
        ))}
      </View>

      {docs.length > 0 ? (
        <View style={styles.statusRail}>
          <StatusDot label={`${readyCount} ready`} tone="green" />
          <StatusDot label={`${inProgressCount} reading`} tone="blue" />
          <StatusDot label={`${failedCount} failed`} tone="red" />
          {pendingCount > 0 ? <StatusDot label={`${pendingCount} pending`} tone="neutral" /> : null}
        </View>
      ) : null}

      <View style={styles.chips}>
        {FILTER_OPTIONS.map((option) => (
          <SelectablePill
            key={option.value}
            label={option.label}
            selected={filter === option.value}
            onPress={() => setFilter(option.value)}
            tone={option.tone}
          />
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : docs.length === 0 ? (
        <Card>
          <EmptyState
            icon="file-plus"
            title={
              hasManagedProfiles && activeProfileId === null ? 'Choose a profile' : 'No records'
            }
            body={
              hasManagedProfiles && activeProfileId === null
                ? 'Choose a profile above.'
                : 'Upload or forward a report.'
            }
            action={<Button label="Add record" onPress={() => router.push('/documents/new')} />}
          />
        </Card>
      ) : filteredDocs.length === 0 ? (
        <Card>
          <EmptyState
            icon="search"
            title="No matching documents"
            body="Try another lab, date, or status."
          />
        </Card>
      ) : (
        <Card style={styles.listCard}>
          {filteredDocs.map((doc) => (
            <DocumentRow key={doc.id} item={doc} />
          ))}
        </Card>
      )}

      {docs.length > 0 ? (
        <Text style={styles.resultCount}>
          {filteredDocs.length === docs.length
            ? `${docs.length} documents`
            : `${filteredDocs.length} of ${docs.length} shown`}
        </Text>
      ) : null}
    </AppScroll>
  );
}

function DocumentRow({ item }: { item: DocumentSummary }) {
  const status = item.ocrStatus as OcrStatus;
  const icon: Parameters<typeof ListIcon>[0]['icon'] =
    item.docType === DocType.Prescription
      ? 'edit-3'
      : item.docType === DocType.ImagingReport
        ? 'image'
        : item.docType === DocType.DischargeSummary
          ? 'scissors'
          : item.docType === DocType.VaccinationRecord
            ? 'shield'
            : status === OcrStatus.Failed
              ? 'alert-circle'
              : 'file-text';
  return (
    <Row
      left={<ListIcon icon={icon} />}
      title={documentTitle(item)}
      subtitle={documentSubtitle(item)}
      right={<Pill label={STATUS_LABELS[status] ?? status} tone={statusTone(status)} />}
      onPress={() => router.push(`/documents/${item.id}`)}
    />
  );
}

function StatusDot({
  label,
  tone,
}: {
  label: string;
  tone: 'green' | 'blue' | 'red' | 'neutral';
}) {
  const toneStyle = {
    green: styles.statusDot_green,
    blue: styles.statusDot_blue,
    red: styles.statusDot_red,
    neutral: styles.statusDot_neutral,
  }[tone];

  return (
    <View style={styles.statusDotItem}>
      <View style={[styles.statusDot, toneStyle]} />
      <Text style={styles.statusDotLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  profileChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  categoryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statusRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: 2,
  },
  statusDotItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusDot_green: { backgroundColor: colors.secondary },
  statusDot_blue: { backgroundColor: colors.primaryDark },
  statusDot_red: { backgroundColor: colors.danger },
  statusDot_neutral: { backgroundColor: colors.textMuted },
  statusDotLabel: { color: colors.textSecondary, fontSize: 11, lineHeight: 15, fontWeight: '700' },
  listCard: { paddingTop: spacing.sm, paddingBottom: spacing.sm },
  resultCount: {
    alignSelf: 'center',
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
});
