import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import type { DoctorShare } from '@medical-tracker/shared-types';
import { ShareExpiry } from '@medical-tracker/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ComponentProps } from 'react';
import {
  Alert,
  Clipboard,
  Linking,
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
  HeroCard,
  IconButton,
  Pill,
  Row,
  TopBar,
  typography,
} from '../src/components/healthfolio';
import { TextField } from '../src/components/ui';
import { createShare, listShares, revokeShare } from '../src/lib/api/endpoints';
import { useProfileStore } from '../src/lib/profile/profileStore';
import { colors, radius, spacing, tapTarget } from '../src/theme/tokens';

const EXPIRY_OPTIONS = [
  { label: '24 hr', value: ShareExpiry.OneDay },
  { label: '7 days', value: ShareExpiry.OneWeek },
  { label: '30 days', value: ShareExpiry.OneMonth },
];

type FeatherName = ComponentProps<typeof Feather>['name'];

export default function SharesScreen() {
  const qc = useQueryClient();
  const activeProfileId = useProfileStore((state) => state.activeProfileId);
  const [showCreate, setShowCreate] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [draftDate, setDraftDate] = useState(new Date());
  const [editingField, setEditingField] = useState<'from' | 'to' | null>(null);
  const [expiry, setExpiry] = useState<ShareExpiry>(ShareExpiry.OneWeek);
  const [note, setNote] = useState('');
  const [singleUse, setSingleUse] = useState(true);
  const [copiedShareId, setCopiedShareId] = useState<string | null>(null);

  function formatDate(value: Date): string {
    const year = String(value.getFullYear());
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function openDatePicker(field: 'from' | 'to'): void {
    setEditingField(field);
    setDraftDate(field === 'from' ? (dateFrom ?? new Date()) : (dateTo ?? dateFrom ?? new Date()));
  }

  const { data: shares, isLoading } = useQuery<DoctorShare[]>({
    queryKey: ['shares'],
    queryFn: listShares,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createShare({
        dateRangeStart: formatDate(dateFrom as Date),
        dateRangeEnd: formatDate(dateTo as Date),
        expiry,
        singleUse,
        customNote: note.trim() || undefined,
        ...(activeProfileId ? { profileUserId: activeProfileId } : {}),
      }),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ['shares'] });
      setShowCreate(false);
      resetForm();
      await Share.share({ message: res.shareUrl, url: res.shareUrl });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeShare(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shares'] }),
  });

  function resetForm() {
    setDateFrom(null);
    setDateTo(null);
    setEditingField(null);
    setExpiry(ShareExpiry.OneWeek);
    setNote('');
    setSingleUse(true);
  }

  function confirmRevoke(share: DoctorShare) {
    Alert.alert('Revoke share', 'The doctor will no longer be able to access this link.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Revoke', style: 'destructive', onPress: () => revokeMutation.mutate(share.id) },
    ]);
  }

  function shareUrlFor(share: DoctorShare): string | null {
    return share.shareUrl ?? null;
  }

  function showMissingShareUrl(): void {
    Alert.alert(
      'Link unavailable',
      'Update the doctor-share backend so existing share rows include their public link.',
    );
  }

  function copyExistingShare(share: DoctorShare): void {
    const url = shareUrlFor(share);
    if (!url) {
      showMissingShareUrl();
      return;
    }
    Clipboard.setString(url);
    setCopiedShareId(share.id);
    setTimeout(() => setCopiedShareId(null), 1800);
  }

  async function shareExistingLink(share: DoctorShare): Promise<void> {
    const url = shareUrlFor(share);
    if (!url) {
      showMissingShareUrl();
      return;
    }
    await Share.share({ message: url, url });
  }

  function openExistingLink(share: DoctorShare): void {
    const url = shareUrlFor(share);
    if (!url) {
      showMissingShareUrl();
      return;
    }

    const open = () => void Linking.openURL(url);
    if (share.singleUse) {
      Alert.alert(
        'Open single-use link?',
        'Opening this preview may count as the one allowed use.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open', onPress: open },
        ],
      );
      return;
    }
    open();
  }

  const active = (shares ?? []).filter(
    (share) => !share.revokedAt && new Date(share.expiresAt) > new Date(),
  );

  return (
    <AppScroll>
      <TopBar
        title="Share"
        action={
          <IconButton
            icon="plus"
            label="New share link"
            onPress={() => setShowCreate(true)}
            style={styles.newButton}
          />
        }
      />
      <HeroCard tone="dark">
        <Text style={[typography.h3, { color: colors.textPrimary }]}>Doctor link</Text>
        <Text
          style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs }]}
        >
          Read-only. Date-limited.
        </Text>
      </HeroCard>

      <Card>
        <Text style={typography.h3}>Links</Text>
        {isLoading ? (
          <Text style={[typography.body, { marginTop: spacing.sm }]}>Loading...</Text>
        ) : active.length === 0 ? (
          <Text style={[typography.body, { marginTop: spacing.sm }]}>No active share links.</Text>
        ) : (
          active.map((share) => (
            <ShareLinkRow
              key={share.id}
              share={share}
              copied={copiedShareId === share.id}
              onCopy={() => copyExistingShare(share)}
              onShare={() => void shareExistingLink(share)}
              onOpen={() => openExistingLink(share)}
              onRevoke={() => confirmRevoke(share)}
            />
          ))
        )}
      </Card>

      <Modal visible={showCreate} animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <AppScroll contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
          <Text style={typography.h2}>Create share link</Text>
          <Text style={[typography.body, { marginTop: spacing.xs, marginBottom: spacing.md }]}>
            Choose a date range.
          </Text>
          <View style={styles.dateGroup}>
            <Text style={styles.label}>Date from</Text>
            <Pressable style={styles.dateField} onPress={() => openDatePicker('from')}>
              <Text style={[styles.dateText, !dateFrom && styles.datePlaceholder]}>
                {dateFrom ? formatDate(dateFrom) : 'Select date'}
              </Text>
              <Feather name="calendar" size={17} color={colors.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.dateGroup}>
            <Text style={styles.label}>Date to</Text>
            <Pressable style={styles.dateField} onPress={() => openDatePicker('to')}>
              <Text style={[styles.dateText, !dateTo && styles.datePlaceholder]}>
                {dateTo ? formatDate(dateTo) : 'Select date'}
              </Text>
              <Feather name="calendar" size={17} color={colors.textSecondary} />
            </Pressable>
          </View>
          <Text style={styles.label}>Expiry</Text>
          <View style={styles.expiryRow}>
            {EXPIRY_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                style={[styles.expiryChip, expiry === opt.value && styles.expiryChipActive]}
                onPress={() => setExpiry(opt.value)}
              >
                <Text
                  style={[
                    styles.expiryChipText,
                    expiry === opt.value && styles.expiryChipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Row
            title="Single-use"
            right={
              <Pill label={singleUse ? 'On' : 'Off'} tone={singleUse ? 'active' : 'neutral'} />
            }
            onPress={() => setSingleUse(!singleUse)}
          />
          <TextField
            label="Note for doctor"
            value={note}
            onChangeText={setNote}
            placeholder="Optional"
            multiline
          />
          <Button
            label="Create share link"
            loading={createMutation.isPending}
            disabled={!dateFrom || !dateTo}
            onPress={() => createMutation.mutate()}
          />
          <Button
            label="Cancel"
            variant="secondary"
            onPress={() => {
              setShowCreate(false);
              resetForm();
            }}
          />
        </AppScroll>
      </Modal>

      <Modal
        visible={editingField !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setEditingField(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.dateSheet}>
            <Text style={styles.sheetTitle}>
              {editingField === 'from' ? 'Date from' : 'Date to'}
            </Text>
            <DateTimePicker
              value={draftDate}
              mode="date"
              display="spinner"
              style={styles.datePicker}
              maximumDate={new Date()}
              minimumDate={editingField === 'to' && dateFrom ? dateFrom : new Date(1900, 0, 1)}
              onChange={(_, selectedDate) => {
                if (selectedDate) setDraftDate(selectedDate);
              }}
            />
            <View style={styles.sheetActions}>
              <Button
                label="Cancel"
                variant="secondary"
                onPress={() => setEditingField(null)}
                style={styles.sheetButton}
              />
              <Button
                label="Done"
                onPress={() => {
                  if (editingField === 'from') {
                    setDateFrom(draftDate);
                    if (dateTo && draftDate > dateTo) setDateTo(draftDate);
                  } else {
                    setDateTo(draftDate);
                  }
                  setEditingField(null);
                }}
                style={styles.sheetButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </AppScroll>
  );
}

function ShareLinkRow({
  share,
  copied,
  onCopy,
  onShare,
  onOpen,
  onRevoke,
}: {
  share: DoctorShare;
  copied: boolean;
  onCopy: () => void;
  onShare: () => void;
  onOpen: () => void;
  onRevoke: () => void;
}) {
  return (
    <View style={styles.shareLinkRow}>
      <View style={styles.shareLinkHeader}>
        <View style={styles.shareLinkText}>
          <Text style={styles.shareLinkTitle}>
            {new Date(share.dateRangeStart).toLocaleDateString()} to{' '}
            {new Date(share.dateRangeEnd).toLocaleDateString()}
          </Text>
          <Text style={styles.shareLinkSubtitle}>
            Expires {new Date(share.expiresAt).toLocaleString()}
            {share.singleUse ? ' - Single use' : ''}
          </Text>
        </View>
        <Pill label={share.singleUse ? 'Single' : 'Reusable'} tone="neutral" />
      </View>
      <View style={styles.shareActionRow}>
        <ShareActionButton
          icon={copied ? 'check' : 'copy'}
          label={copied ? 'Copied' : 'Copy'}
          onPress={onCopy}
        />
        <ShareActionButton icon="share-2" label="Share" onPress={onShare} />
        <ShareActionButton icon="external-link" label="Open" onPress={onOpen} />
        <ShareActionButton icon="x-circle" label="Revoke" tone="danger" onPress={onRevoke} />
      </View>
    </View>
  );
}

function ShareActionButton({
  icon,
  label,
  tone = 'neutral',
  onPress,
}: {
  icon: FeatherName;
  label: string;
  tone?: 'neutral' | 'danger';
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.shareAction, tone === 'danger' && styles.shareActionDanger]}
    >
      <Feather name={icon} size={15} color={tone === 'danger' ? colors.danger : colors.primary} />
      <Text style={[styles.shareActionText, tone === 'danger' && styles.shareActionTextDanger]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  newButton: { width: 48, height: 48, borderRadius: 24 },
  shareLinkRow: {
    borderTopWidth: 1,
    borderTopColor: colors.mutedBorder,
    paddingTop: spacing.md,
    marginTop: spacing.md,
  },
  shareLinkHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  shareLinkText: { flex: 1 },
  shareLinkTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  shareLinkSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  shareActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  shareAction: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.sm,
  },
  shareActionDanger: {
    borderColor: colors.danger,
    backgroundColor: colors.redBg,
  },
  shareActionText: { color: colors.primary, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  shareActionTextDanger: { color: colors.danger },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  dateGroup: { marginBottom: spacing.md },
  dateField: {
    minHeight: tapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.md,
  },
  dateText: { color: colors.textPrimary, fontSize: 14 },
  datePlaceholder: { color: colors.textSecondary },
  expiryRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  expiryChip: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  expiryChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  expiryChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  expiryChipTextActive: { color: '#FFFFFF' },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(17,24,29,0.38)',
  },
  dateSheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  sheetTitle: { color: colors.textPrimary, fontSize: 16, lineHeight: 21, fontWeight: '700' },
  datePicker: { height: 216 },
  sheetActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  sheetButton: { flex: 1, marginTop: 0 },
});
