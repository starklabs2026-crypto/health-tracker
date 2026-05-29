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
  Pill,
  Row,
  SearchField,
  SelectablePill,
  TopBar,
  typography,
} from '../../src/components/healthfolio';
import { listDocuments, listFamilyMembers } from '../../src/lib/api/endpoints';
import { useProfileStore } from '../../src/lib/profile/profileStore';
import { colors, spacing } from '../../src/theme/tokens';

const DOC_TYPE_LABELS: Record<DocType, string> = {
  [DocType.LabReport]: 'Lab report',
  [DocType.Prescription]: 'Prescription',
  [DocType.ImagingReport]: 'Imaging report',
  [DocType.DischargeSummary]: 'Discharge summary',
  [DocType.VaccinationRecord]: 'Vaccination record',
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
  if (status === OcrStatus.ReadyForReview) return 'amber';
  if (status === OcrStatus.Failed) return 'red';
  if (status === OcrStatus.Queued || status === OcrStatus.Processing) return 'blue';
  if (status === OcrStatus.PendingUpload) return 'neutral';
  return 'green';
}

type DocumentFilter = 'all' | 'ready' | 'progress' | 'failed';

const FILTER_OPTIONS: ReadonlyArray<{
  label: string;
  value: DocumentFilter;
  tone: 'active' | 'amber' | 'blue' | 'red';
}> = [
  { label: 'All', value: 'all', tone: 'active' },
  { label: 'Ready', value: 'ready', tone: 'amber' },
  { label: 'In progress', value: 'progress', tone: 'blue' },
  { label: 'Failed', value: 'failed', tone: 'red' },
];

function matchesFilter(status: OcrStatus, filter: DocumentFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'ready') return status === OcrStatus.ReadyForReview;
  if (filter === 'progress') return status === OcrStatus.Queued || status === OcrStatus.Processing;
  return status === OcrStatus.Failed;
}

function toSearchableText(item: DocumentSummary): string {
  return [
    DOC_TYPE_LABELS[item.docType as DocType] ?? item.docType,
    item.labName ?? '',
    item.sourceDate,
    new Date(item.sourceDate).toLocaleDateString(),
    STATUS_LABELS[item.ocrStatus as OcrStatus] ?? item.ocrStatus,
  ]
    .join(' ')
    .toLowerCase();
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
  const { activeProfileId, activeProfileName, setActiveProfile } = useProfileStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DocumentFilter>('all');
  const { data: members } = useQuery({
    queryKey: ['family', 'members'],
    queryFn: listFamilyMembers,
  });
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['documents', activeProfileId],
    queryFn: () =>
      listDocuments({ ...(activeProfileId ? { profileId: activeProfileId } : {}), limit: 100 }),
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
      if (!normalizedQuery) return true;
      return toSearchableText(item).includes(normalizedQuery);
    });
  }, [docs, filter, query]);

  return (
    <AppScroll
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
    >
      <TopBar
        eyebrow={activeProfileName ? `Selected profile: ${activeProfileName}` : 'Selected profile'}
        title="Documents"
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

      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Search document, lab, or date"
      />

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
              hasManagedProfiles && activeProfileId === null
                ? 'Choose a profile'
                : 'No documents yet'
            }
            body={
              hasManagedProfiles && activeProfileId === null
                ? 'Uploaded reports were grouped into managed profiles. Select a profile above to view its documents.'
                : 'Upload a lab report to extract readings and organize your timeline.'
            }
            action={<Button label="Add document" onPress={() => router.push('/documents/new')} />}
          />
        </Card>
      ) : filteredDocs.length === 0 ? (
        <Card>
          <EmptyState
            icon="search"
            title="No matching documents"
            body="Try another lab name, date, or document status."
          />
        </Card>
      ) : (
        <Card>
          {filteredDocs.map((doc) => (
            <DocumentRow key={doc.id} item={doc} />
          ))}
        </Card>
      )}

      {docs.length > 0 ? (
        <Card>
          <View style={styles.summaryHeader}>
            <Text style={typography.h3}>Document status</Text>
            <Text style={typography.bodySmall}>
              {filteredDocs.length === docs.length
                ? `${docs.length} documents`
                : `${filteredDocs.length} of ${docs.length} shown`}
            </Text>
          </View>
          <View style={styles.summaryPills}>
            <Pill label={`${readyCount} ready`} tone="amber" />
            <Pill label={`${inProgressCount} in progress`} tone="blue" />
            <Pill label={`${failedCount} failed`} tone="red" />
            {pendingCount > 0 ? <Pill label={`${pendingCount} pending`} tone="neutral" /> : null}
          </View>
          <Text style={styles.summaryNote}>
            Search filters the current document list locally. Statuses reflect the current document
            review process.
          </Text>
        </Card>
      ) : null}
    </AppScroll>
  );
}

function DocumentRow({ item }: { item: DocumentSummary }) {
  const status = item.ocrStatus as OcrStatus;
  return (
    <Row
      title={DOC_TYPE_LABELS[item.docType as DocType] ?? item.docType}
      subtitle={`${item.labName ?? 'Unknown source'}, ${new Date(item.sourceDate).toLocaleDateString()}`}
      right={<Pill label={STATUS_LABELS[status] ?? status} tone={statusTone(status)} />}
      onPress={() => router.push(`/documents/${item.id}`)}
    />
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
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  summaryPills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  summaryNote: { color: colors.textSecondary, fontSize: 12, lineHeight: 16, marginTop: spacing.md },
});
