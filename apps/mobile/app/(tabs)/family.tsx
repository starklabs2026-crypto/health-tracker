import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { FamilyLink, FamilyMemberView } from '@medical-tracker/shared-types';
import { FamilyLinkStatus, FamilyRole, Sex, UnitsPreference } from '@medical-tracker/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  AppScroll,
  Avatar,
  Button,
  Card,
  EmptyState,
  FamilyProfilesVisual,
  Pill,
  TopBar,
  typography,
} from '../../src/components/healthfolio';
import { Segmented, TextField } from '../../src/components/ui';
import {
  createManagedProfile,
  listFamilyMembers,
  revokeFamilyLink,
  updateManagedProfile,
} from '../../src/lib/api/endpoints';
import { useProfileStore } from '../../src/lib/profile/profileStore';
import { colors, spacing } from '../../src/theme/tokens';

const ROLE_LABELS: Record<FamilyRole, string> = {
  [FamilyRole.Viewer]: 'Viewer',
  [FamilyRole.Contributor]: 'Contributor',
  [FamilyRole.Guardian]: 'Guardian',
};

function statusTone(status: FamilyLinkStatus): 'green' | 'amber' | 'red' | 'neutral' {
  if (status === FamilyLinkStatus.Active) return 'green';
  if (status === FamilyLinkStatus.Pending) return 'amber';
  if (status === FamilyLinkStatus.Declined) return 'red';
  return 'neutral';
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function editableDob(value: string): Date | null {
  if (value.startsWith('1900-01-01')) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function memberSubtitle(member: FamilyMemberView, selected: boolean): string {
  const dob = editableDob(member.memberDob);
  const profileType = selected ? 'Selected profile' : ROLE_LABELS[member.link.role];
  return `${profileType} - ${dob ? formatDate(dob) : 'DOB not set'}`;
}

export default function FamilyScreen() {
  const qc = useQueryClient();
  const { activeProfileId, setActiveProfile } = useProfileStore();
  const [showCreate, setShowCreate] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMemberView | null>(null);
  const [name, setName] = useState('');
  const [dob, setDob] = useState<Date | null>(null);
  const [draftDob, setDraftDob] = useState(new Date(2000, 0, 1));
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [sex, setSex] = useState<Sex | null>(null);
  const isEditing = editingMember !== null;
  const showProfileForm = showCreate || isEditing;

  const { data: members, isLoading } = useQuery<FamilyMemberView[]>({
    queryKey: ['family', 'members'],
    queryFn: listFamilyMembers,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createManagedProfile({
        name: name.trim(),
        dob: formatDate(dob as Date),
        sex: sex as Sex,
        unitsPreference: UnitsPreference.Metric,
      }),
    onSuccess: async ({ profileId }) => {
      await qc.invalidateQueries({ queryKey: ['family'] });
      setActiveProfile(profileId, name.trim());
      resetForm();
      setShowCreate(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      updateManagedProfile((editingMember as FamilyMemberView).link.memberUserId, {
        name: name.trim(),
        dob: formatDate(dob as Date),
        sex: sex as Sex,
        unitsPreference: UnitsPreference.Metric,
      }),
    onSuccess: async () => {
      const profileId = editingMember?.link.memberUserId;
      await qc.invalidateQueries({ queryKey: ['family'] });
      await qc.invalidateQueries({ queryKey: ['documents'] });
      await qc.invalidateQueries({ queryKey: ['readings'] });
      await qc.invalidateQueries({ queryKey: ['trend'] });
      if (profileId && activeProfileId === profileId) {
        setActiveProfile(profileId, name.trim());
      }
      closeProfileForm();
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeFamilyLink(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['family'] }),
  });

  function resetForm(): void {
    setName('');
    setDob(null);
    setDraftDob(new Date(2000, 0, 1));
    setShowDobPicker(false);
    setSex(null);
  }

  function beginCreateProfile(): void {
    resetForm();
    setEditingMember(null);
    setShowCreate(true);
  }

  function beginEditProfile(member: FamilyMemberView): void {
    setEditingMember(member);
    setShowCreate(false);
    setName(member.memberName);
    const parsedDob = editableDob(member.memberDob);
    setDob(parsedDob);
    setDraftDob(parsedDob ?? new Date(2000, 0, 1));
    setSex(member.memberSex);
    setShowDobPicker(false);
  }

  function closeProfileForm(): void {
    setShowCreate(false);
    setEditingMember(null);
    resetForm();
  }

  function confirmRevoke(link: FamilyLink, member: FamilyMemberView): void {
    Alert.alert('Remove profile', `Remove ${member.memberName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          if (activeProfileId === link.memberUserId) {
            setActiveProfile(null, null);
          }
          revokeMutation.mutate(link.id);
        },
      },
    ]);
  }

  function onSaveProfile(): void {
    if (!name.trim() || !dob || !sex) {
      Alert.alert('Missing details', 'Enter a name, date of birth, and gender.');
      return;
    }
    if (isEditing) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  }

  return (
    <AppScroll>
      <TopBar
        eyebrow="Profiles"
        title="Family"
        action={<Button label="Add" onPress={beginCreateProfile} style={styles.addButton} />}
      />

      <Card style={styles.profileCard}>
        <ProfileRow
          title="My profile"
          subtitle={activeProfileId === null ? 'Selected profile' : 'Personal record'}
          selected={activeProfileId === null}
          right={
            activeProfileId === null ? <Pill label="Active" tone="active" /> : <Avatar label="Me" />
          }
          onPress={() => setActiveProfile(null, null)}
        />
      </Card>

      <Card>
        <Text style={typography.h3}>Managed profiles</Text>
        {isLoading ? (
          <Text style={[typography.body, { marginTop: spacing.sm }]}>Loading...</Text>
        ) : !members || members.length === 0 ? (
          <View style={styles.emptyFamily}>
            <FamilyProfilesVisual />
            <EmptyState
              icon="users"
              title="No profiles found yet"
              body="Upload reports and profiles will appear by document name."
              action={
                <Button label="Upload reports" onPress={() => router.push('/documents/new')} />
              }
            />
          </View>
        ) : (
          members.map((member) => {
            const selected = activeProfileId === member.link.memberUserId;
            return (
              <ProfileRow
                key={member.link.id}
                title={member.memberName}
                subtitle={memberSubtitle(member, selected)}
                selected={selected}
                right={
                  <View style={styles.memberActions}>
                    <Pill
                      label={selected ? 'Active' : member.link.status}
                      tone={selected ? 'active' : statusTone(member.link.status)}
                    />
                    <Button
                      label="Edit"
                      variant="secondary"
                      onPress={() => beginEditProfile(member)}
                      style={styles.editButton}
                    />
                    <Button
                      label="Remove"
                      variant="secondary"
                      onPress={() => confirmRevoke(member.link, member)}
                      style={styles.removeButton}
                    />
                  </View>
                }
                onPress={() => setActiveProfile(member.link.memberUserId, member.memberName)}
              />
            );
          })
        )}
      </Card>

      <Modal visible={showProfileForm} animationType="slide" onRequestClose={closeProfileForm}>
        <AppScroll contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
          <Text style={typography.h2}>{isEditing ? 'Edit profile' : 'Add profile'}</Text>
          <Text style={[typography.body, { marginTop: spacing.xs, marginBottom: spacing.md }]}>
            {isEditing
              ? 'Update the details used for this health record.'
              : 'Add a profile you manage.'}
          </Text>

          <TextField
            label="Full name"
            value={name}
            onChangeText={setName}
            placeholder="Full name"
          />
          <Button
            label={dob ? `DOB ${formatDate(dob)}` : 'Select date of birth'}
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

          <Button
            label={isEditing ? 'Save profile' : 'Create profile'}
            loading={createMutation.isPending || updateMutation.isPending}
            onPress={onSaveProfile}
          />
          <Button label="Cancel" variant="secondary" onPress={closeProfileForm} />

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
    </AppScroll>
  );
}

function ProfileRow({
  title,
  subtitle,
  right,
  selected,
  onPress,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.profileRow, selected && styles.profileRowSelected]}
    >
      <View style={[styles.profileRail, selected && styles.profileRailSelected]}>
        {selected ? <Feather name="check" size={13} color="#FFFFFF" /> : null}
      </View>
      <View style={styles.profileRowText}>
        <Text style={[styles.profileTitle, selected && styles.profileTitleSelected]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.profileSubtitle, selected && styles.profileSubtitleSelected]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  addButton: { minWidth: 78, minHeight: 38, marginTop: 0, paddingHorizontal: spacing.md },
  profileCard: { padding: spacing.sm },
  profileRow: {
    minHeight: 76,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  profileRowSelected: {
    backgroundColor: '#F0FBF8',
    borderColor: 'rgba(15,118,110,0.28)',
  },
  profileRail: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E6EEF0',
  },
  profileRailSelected: { backgroundColor: colors.primary },
  profileRowText: { flex: 1 },
  profileTitle: { color: colors.textPrimary, fontSize: 16, lineHeight: 21, fontWeight: '800' },
  profileTitleSelected: { color: colors.primaryDark },
  profileSubtitle: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 2 },
  profileSubtitleSelected: { color: colors.primaryDark, fontWeight: '700' },
  memberActions: { alignItems: 'flex-end', gap: spacing.xs },
  editButton: { minHeight: 30, marginTop: 0, paddingHorizontal: spacing.sm },
  removeButton: { minHeight: 30, marginTop: 0, paddingHorizontal: spacing.sm },
  emptyFamily: { marginTop: spacing.sm },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(16,24,39,0.18)',
  },
  dateSheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  sheetTitle: { color: colors.textPrimary, fontSize: 16, lineHeight: 21, fontWeight: '800' },
  sheetActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  sheetButton: { flex: 1, marginTop: 0 },
});
