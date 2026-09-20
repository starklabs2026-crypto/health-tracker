import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BloodGroup, Sex, UnitsPreference } from '@medical-tracker/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Clipboard, Linking, Modal, StyleSheet, Switch, Text, View } from 'react-native';

import {
  AppScroll,
  Avatar,
  Button,
  Card,
  IconButton,
  ListIcon,
  LoadingScreen,
  Pill,
  Row,
  SectionHeader,
  SelectablePill,
  TopBar,
  typography,
} from '../../src/components/healthfolio';
import { Segmented, TextField } from '../../src/components/ui';
import {
  claimInboundEmailAlias,
  createPdfExportUrl,
  deleteAccount,
  getMe,
  pairBiometric,
  updateMe,
} from '../../src/lib/api/endpoints';
import { useAuthStore } from '../../src/lib/auth/authStore';
import { signOut } from '../../src/lib/auth/session';
import { publicRuntimeConfig } from '../../src/lib/config';
import { colors, spacing } from '../../src/theme/tokens';

const PRIVACY_URL = 'https://starklabs2026-crypto.github.io/health-tracker/privacy/';
const SUPPORT_URL = 'https://starklabs2026-crypto.github.io/health-tracker/support/';
const ALIAS_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;
const BLOOD_GROUP_OPTIONS = Object.values(BloodGroup);

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function editableDob(value: string | null | undefined): Date | null {
  if (!value || value.startsWith('1970-01-01')) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeAliasInput(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[._\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .slice(0, 32);
}

function aliasValidationMessage(value: string): string | null {
  if (ALIAS_PATTERN.test(value)) return null;
  return 'Use 3 to 32 lowercase letters, numbers, and hyphens.';
}

function forwardingAddressFor(alias: string | null | undefined): string | null {
  if (!alias) return null;
  const template = publicRuntimeConfig.inboundEmailAddressTemplate;
  if (template?.includes('{alias}')) return template.replaceAll('{alias}', alias);
  if (publicRuntimeConfig.inboundEmailDomain) {
    return `${alias}@${publicRuntimeConfig.inboundEmailDomain}`;
  }
  return alias;
}

export default function Profile() {
  const qc = useQueryClient();
  const setUnlocked = useAuthStore((s) => s.setUnlocked);
  const { data, isLoading } = useQuery({ queryKey: ['me'], queryFn: getMe });

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [dob, setDob] = useState<Date | null>(null);
  const [draftDob, setDraftDob] = useState(new Date(2000, 0, 1));
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [sex, setSex] = useState<Sex | null>(null);
  const [units, setUnits] = useState<UnitsPreference>(UnitsPreference.Metric);
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | null>(null);
  const [biometric, setBiometric] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteAcknowledged, setDeleteAcknowledged] = useState(false);
  const [aliasModalVisible, setAliasModalVisible] = useState(false);
  const [alias, setAlias] = useState('');
  const [aliasError, setAliasError] = useState<string | null>(null);
  const [addressCopied, setAddressCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: updateMe,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['me'] });
      setEditing(false);
    },
  });
  const aliasMutation = useMutation({
    mutationFn: claimInboundEmailAlias,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['me'] });
      setAliasModalVisible(false);
      setAliasError(null);
      Alert.alert('Alias updated', 'Your new forwarding address is ready.');
    },
    onError: (error) => {
      setAliasError(error instanceof Error ? error.message : 'Could not update this alias.');
    },
  });
  const exportMutation = useMutation({
    mutationFn: () => createPdfExportUrl(),
    onSuccess: async ({ downloadUrl }) => {
      await Linking.openURL(downloadUrl);
    },
    onError: () => {
      Alert.alert('Export failed', 'Could not create the PDF export. Please try again.');
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: async () => {
      qc.clear();
      try {
        await signOut();
      } catch {
        // The server may have already removed the auth account; local state still gets cleared below.
      }
      setUnlocked(false);
      setDeleteModalVisible(false);
      setDeleteAcknowledged(false);
      router.replace('/welcome');
      Alert.alert(
        'Account deleted',
        'Your HealthFolio account and all associated user data have been deleted. We do not store your user data after deletion.',
      );
    },
    onError: () => {
      Alert.alert(
        'Deletion failed',
        'We could not delete your account. Please try again or contact support.',
      );
    },
  });

  function openEdit(): void {
    if (!data) return;
    setName(data.user.name);
    const parsedDob = editableDob(data.user.dob);
    setDob(parsedDob);
    setDraftDob(parsedDob ?? new Date(2000, 0, 1));
    setSex(data.user.sex);
    setUnits(data.user.unitsPreference);
    setBloodGroup(data.user.bloodGroup ?? null);
    setEditing(true);
  }

  function saveProfile(): void {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Missing name', 'Enter a profile name.');
      return;
    }
    mutation.mutate({
      name: trimmedName,
      ...(dob ? { dob: formatDate(dob) } : {}),
      ...(sex ? { sex } : {}),
      unitsPreference: units,
      bloodGroup,
    });
  }

  function openAliasEdit(): void {
    if (!data) return;
    setAlias(data.user.inboundEmailAlias ?? '');
    setAliasError(null);
    setAliasModalVisible(true);
  }

  function onAliasChange(value: string): void {
    setAlias(normalizeAliasInput(value));
    if (aliasError) setAliasError(null);
  }

  function saveAlias(): void {
    const nextAlias = normalizeAliasInput(alias);
    const validation = aliasValidationMessage(nextAlias);
    setAlias(nextAlias);

    if (validation) {
      setAliasError(validation);
      return;
    }

    aliasMutation.mutate(nextAlias);
  }

  async function onToggleBiometric(value: boolean): Promise<void> {
    setBiometric(value);
    if (value) {
      try {
        await pairBiometric();
      } catch {
        setBiometric(false);
      }
    }
  }

  async function onSignOut(): Promise<void> {
    await signOut();
    setUnlocked(false);
    router.replace('/welcome');
  }

  function openExternalUrl(url: string): void {
    void Linking.openURL(url);
  }

  function copyForwardingAddress(address: string): void {
    Clipboard.setString(address);
    setAddressCopied(true);
    setTimeout(() => setAddressCopied(false), 1800);
  }

  function openDeleteModal(): void {
    setDeleteAcknowledged(false);
    setDeleteModalVisible(true);
  }

  if (isLoading || !data) {
    return <LoadingScreen />;
  }

  const { user } = data;
  const forwardingAddress = forwardingAddressFor(user.inboundEmailAlias);
  const aliasPreviewAddress = forwardingAddressFor(alias);
  const aliasIsValid = !aliasValidationMessage(alias);

  return (
    <AppScroll>
      <TopBar title="Profile" action={<Avatar label={user.name || 'Me'} />} />

      <Card style={styles.identityCard}>
        <View style={styles.identityRow}>
          <View>
            <Text style={styles.name}>{user.name || 'Unnamed profile'}</Text>
            <Text style={typography.bodySmall}>
              {user.email ?? user.phone ?? 'No email on file'}
            </Text>
          </View>
          <IconButton
            icon="edit-2"
            label="Edit profile"
            variant="secondary"
            onPress={openEdit}
            style={styles.editButton}
          />
        </View>
      </Card>

      <Card style={styles.privacyCard}>
        <SectionHeader icon="shield" title="Privacy" style={styles.cardHeader} />
        <Text style={styles.privacyCopy}>
          HealthFolio organizes user-provided records. It does not provide diagnosis, prognosis, or
          medicine intake advice.
        </Text>
      </Card>

      <Card>
        <SectionHeader
          icon="user"
          title="About"
          right={
            <IconButton
              icon="edit-2"
              label="Edit about"
              variant="secondary"
              onPress={openEdit}
              style={styles.sectionEditButton}
            />
          }
          style={styles.cardHeader}
        />
        <Row
          left={<ListIcon icon="calendar" />}
          title="DOB"
          subtitle={user.dob ? new Date(user.dob).toLocaleDateString() : 'Not set'}
          right={<Feather name="chevron-right" size={18} color={colors.textMuted} />}
          onPress={openEdit}
        />
        <Row
          left={<ListIcon icon="user" />}
          title="Gender"
          subtitle={user.sex ?? 'Not specified'}
          right={<Feather name="chevron-right" size={18} color={colors.textMuted} />}
          onPress={openEdit}
        />
        <Row
          left={<ListIcon icon="droplet" />}
          title="Blood"
          subtitle={user.bloodGroup ?? 'Add'}
          right={<Feather name="chevron-right" size={18} color={colors.textMuted} />}
          onPress={openEdit}
        />
        <Row
          left={<ListIcon icon="sliders" />}
          title="Units"
          subtitle={user.unitsPreference ?? 'Metric'}
          right={<Feather name="chevron-right" size={18} color={colors.textMuted} />}
          onPress={openEdit}
        />
      </Card>

      <Card>
        <SectionHeader icon="shield" title="Security" style={styles.cardHeader} />
        <View style={styles.switchRow}>
          <View>
            <Text style={styles.rowTitle}>Biometric lock</Text>
          </View>
          <Switch
            value={biometric}
            onValueChange={(value) => void onToggleBiometric(value)}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={biometric ? '#FFFFFF' : colors.textSecondary}
          />
        </View>
        <Row
          left={<ListIcon icon="download" />}
          title="Export"
          subtitle={exportMutation.isPending ? 'Preparing...' : undefined}
          right={<Pill label={exportMutation.isPending ? 'Working' : 'Start'} />}
          onPress={() => exportMutation.mutate()}
        />
        <Row
          left={<ListIcon icon="share-2" />}
          title="Doctor link"
          right={<Pill label="Open" tone="blue" />}
          onPress={() => router.push('/shares')}
        />
        <Button label="Sign out" variant="danger" onPress={() => void onSignOut()} />
      </Card>

      <Card>
        <SectionHeader icon="inbox" title="Inbox" style={styles.cardHeader} />
        <View style={styles.forwardingBox}>
          <View style={styles.forwardingText}>
            <Text style={styles.forwardingLabel}>Forwarding address</Text>
            <Text selectable style={styles.forwardingAddress}>
              {forwardingAddress ?? 'Preparing your address...'}
            </Text>
            <Text style={styles.forwardingCopy}>Auto-files reports.</Text>
          </View>
          {forwardingAddress ? (
            <Button
              label={addressCopied ? 'Copied' : 'Copy'}
              variant="secondary"
              onPress={() => copyForwardingAddress(forwardingAddress)}
              left={
                <Feather name={addressCopied ? 'check' : 'copy'} size={15} color={colors.primary} />
              }
              style={styles.copyButton}
            />
          ) : null}
        </View>
        <Row
          left={<ListIcon icon="at-sign" />}
          title="Alias"
          subtitle={user.inboundEmailAlias ?? 'Choose a unique alias'}
          right={<Pill label="Edit" tone="blue" />}
          onPress={openAliasEdit}
        />
      </Card>

      <Card>
        <SectionHeader icon="help-circle" title="Help" style={styles.cardHeader} />
        <Row
          left={<ListIcon icon="shield" />}
          title="Privacy"
          right={<Pill label="Open" tone="blue" />}
          onPress={() => openExternalUrl(PRIVACY_URL)}
        />
        <Row
          left={<ListIcon icon="help-circle" />}
          title="Support"
          right={<Pill label="Open" tone="blue" />}
          onPress={() => openExternalUrl(SUPPORT_URL)}
        />
      </Card>

      <Card>
        <SectionHeader icon="trash-2" title="Delete account" style={styles.cardHeader} />
        <Text style={[typography.bodySmall, styles.deletionCopy]}>
          Delete account and stored health data.
        </Text>
        <Button label="Delete account" variant="danger" onPress={openDeleteModal} />
      </Card>

      <Modal visible={editing} animationType="slide" onRequestClose={() => setEditing(false)}>
        <AppScroll contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
          <Text style={typography.h2}>Edit profile</Text>
          <View style={{ marginTop: spacing.md }}>
            <TextField label="Full name" value={name} onChangeText={setName} />
            <Button
              label={dob ? `DOB ${formatDate(dob)}` : 'Set date of birth'}
              variant="secondary"
              onPress={() => {
                setDraftDob(dob ?? new Date(2000, 0, 1));
                setShowDobPicker(true);
              }}
            />
            <Segmented
              label="Gender"
              value={sex}
              onChange={setSex}
              options={[
                { label: 'Female', value: Sex.Female },
                { label: 'Male', value: Sex.Male },
                { label: 'Other', value: Sex.Other },
              ]}
            />
            <Text style={styles.formLabel}>Blood group</Text>
            <View style={styles.bloodGroupGrid}>
              <SelectablePill
                label="Not set"
                selected={bloodGroup === null}
                onPress={() => setBloodGroup(null)}
              />
              {BLOOD_GROUP_OPTIONS.map((group) => (
                <SelectablePill
                  key={group}
                  label={group}
                  selected={bloodGroup === group}
                  onPress={() => setBloodGroup(group)}
                />
              ))}
            </View>
            <Segmented
              label="Units"
              value={units}
              onChange={setUnits}
              options={[
                { label: 'Metric', value: UnitsPreference.Metric },
                { label: 'Imperial', value: UnitsPreference.Imperial },
              ]}
            />
          </View>
          <Button label="Save" loading={mutation.isPending} onPress={saveProfile} />
          <Button label="Cancel" variant="secondary" onPress={() => setEditing(false)} />
          <Modal
            visible={showDobPicker}
            animationType="slide"
            transparent
            onRequestClose={() => setShowDobPicker(false)}
          >
            <View style={styles.modalBackdrop}>
              <View style={styles.dateSheet}>
                <Text style={styles.sheetTitle}>Date of birth</Text>
                <DateTimePicker
                  value={draftDob}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  minimumDate={new Date(1900, 0, 1)}
                  onChange={(_, selectedDate) => {
                    if (selectedDate) setDraftDob(selectedDate);
                  }}
                />
                <View style={styles.sheetActions}>
                  <Button
                    label="Cancel"
                    variant="secondary"
                    onPress={() => setShowDobPicker(false)}
                    style={styles.sheetButton}
                  />
                  <Button
                    label="Done"
                    onPress={() => {
                      setDob(draftDob);
                      setShowDobPicker(false);
                    }}
                    style={styles.sheetButton}
                  />
                </View>
              </View>
            </View>
          </Modal>
        </AppScroll>
      </Modal>

      <Modal
        visible={deleteModalVisible}
        animationType="slide"
        onRequestClose={() => {
          if (!deleteMutation.isPending) setDeleteModalVisible(false);
        }}
      >
        <AppScroll contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
          <Text style={[typography.h2, styles.deleteTitle]}>Delete account</Text>
          <Text style={[typography.body, styles.deleteWarning]}>
            This action is permanent. We will delete your HealthFolio account and all associated
            user data, including profile details, health documents, readings, family profiles you
            manage, doctor-share links, exports, and stored files.
          </Text>
          <Text style={[typography.body, styles.deleteWarning]}>
            After deletion, HealthFolio does not store or retain your user data.
          </Text>
          <Row
            title="I understand this permanently deletes all of my HealthFolio data."
            subtitle="This cannot be undone."
            right={
              <Pill
                label={deleteAcknowledged ? 'Confirmed' : 'Required'}
                tone={deleteAcknowledged ? 'active' : 'neutral'}
              />
            }
            onPress={() => setDeleteAcknowledged((value) => !value)}
          />
          <Button
            label="Permanently delete account"
            variant="danger"
            loading={deleteMutation.isPending}
            disabled={!deleteAcknowledged}
            onPress={() => deleteMutation.mutate()}
          />
          <Button
            label="Cancel"
            variant="secondary"
            disabled={deleteMutation.isPending}
            onPress={() => setDeleteModalVisible(false)}
          />
        </AppScroll>
      </Modal>

      <Modal
        visible={aliasModalVisible}
        animationType="slide"
        onRequestClose={() => {
          if (!aliasMutation.isPending) setAliasModalVisible(false);
        }}
      >
        <AppScroll contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
          <Text style={typography.h2}>Forwarding alias</Text>
          <Text style={[typography.bodySmall, styles.aliasHelp]}>
            Choose the unique part of your forwarding email address.
          </Text>
          <View style={{ marginTop: spacing.md }}>
            <TextField
              label="Alias"
              value={alias}
              onChangeText={onAliasChange}
              placeholder="your-name"
              autoCapitalize="none"
              autoCorrect={false}
              errorText={aliasError ?? undefined}
            />
            <View style={styles.aliasPreview}>
              <Text style={styles.aliasPreviewLabel}>Preview</Text>
              <Text style={styles.aliasPreviewAddress}>
                {aliasPreviewAddress ?? 'test.healthfolio+your-name@gmail.com'}
              </Text>
            </View>
          </View>
          <Button
            label="Save alias"
            loading={aliasMutation.isPending}
            disabled={!aliasIsValid}
            onPress={saveAlias}
          />
          <Button
            label="Cancel"
            variant="secondary"
            disabled={aliasMutation.isPending}
            onPress={() => setAliasModalVisible(false)}
          />
        </AppScroll>
      </Modal>
    </AppScroll>
  );
}

const styles = StyleSheet.create({
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  identityCard: { backgroundColor: colors.primaryBg },
  privacyCard: { backgroundColor: '#FFFFFF' },
  privacyCopy: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
  name: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  editButton: { width: 38, height: 38, borderRadius: 19 },
  sectionEditButton: { width: 34, height: 34, borderRadius: 17 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  cardHeader: { marginTop: 0 },
  rowTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  dangerHeading: { color: colors.danger },
  deletionCopy: { marginTop: spacing.xs, marginBottom: spacing.sm },
  forwardingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 0,
    borderRadius: 22,
    backgroundColor: colors.surfaceInset,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  forwardingText: { flex: 1 },
  forwardingLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
  forwardingAddress: { color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 4 },
  forwardingCopy: { color: colors.textSecondary, fontSize: 12, lineHeight: 16, marginTop: 4 },
  copyButton: { minHeight: 34, minWidth: 88, marginTop: 0, paddingHorizontal: spacing.sm },
  formLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  bloodGroupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
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
  sheetActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  sheetButton: { flex: 1, marginTop: 0 },
  aliasHelp: { marginTop: spacing.sm },
  aliasPreview: {
    borderWidth: 0,
    borderRadius: 18,
    backgroundColor: colors.surfaceInset,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  aliasPreviewLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  aliasPreviewAddress: { color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 4 },
  deleteTitle: { color: colors.danger },
  deleteWarning: { marginTop: spacing.sm },
});
