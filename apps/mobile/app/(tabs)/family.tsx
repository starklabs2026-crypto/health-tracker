import type { FamilyLink, FamilyMemberView } from '@medical-tracker/shared-types';
import { FamilyLinkStatus, FamilyRole } from '@medical-tracker/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Modal, StyleSheet, Text, View } from 'react-native';

import { AppScroll, Avatar, Button, Card, EmptyState, FamilyProfilesVisual, Pill, Row, TopBar, typography } from '../../src/components/healthfolio';
import { TextField } from '../../src/components/ui';
import { inviteMember, listFamilyMembers, revokeFamilyLink } from '../../src/lib/api/endpoints';
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

export default function FamilyScreen() {
  const qc = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [identifier, setIdentifier] = useState('');

  const { data: members, isLoading } = useQuery<FamilyMemberView[]>({
    queryKey: ['family', 'members'],
    queryFn: listFamilyMembers,
  });

  const inviteMutation = useMutation({
    mutationFn: () => inviteMember({ memberIdentifier: identifier, role: FamilyRole.Viewer }),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ['family'] });
      setShowInvite(false);
      setIdentifier('');
      Alert.alert('Invite created', `Share this token:\n\n${res.inviteToken}`);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeFamilyLink(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['family'] }),
  });

  function confirmRevoke(link: FamilyLink, name: string): void {
    Alert.alert('Remove member', `Remove ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => revokeMutation.mutate(link.id) },
    ]);
  }

  return (
    <AppScroll>
      <TopBar
        eyebrow="Profiles"
        title="Family"
        action={<Button label="Add" onPress={() => setShowInvite(true)} style={styles.addButton} />}
      />

      <Card style={styles.currentCard}>
        <View style={styles.currentRow}>
          <View>
            <Text style={typography.bodySmall}>Current profile</Text>
            <Text style={typography.h3}>My profile</Text>
            <Text style={typography.bodySmall}>Active health record</Text>
          </View>
          <Avatar label="Me" />
        </View>
      </Card>

      <Card>
        <Text style={typography.h3}>Linked members</Text>
        {isLoading ? (
          <Text style={[typography.body, { marginTop: spacing.sm }]}>Loading...</Text>
        ) : !members || members.length === 0 ? (
          <View style={styles.emptyFamily}>
            <FamilyProfilesVisual />
            <EmptyState
              icon="users"
              title="No linked members"
              body="Add a family profile when you are ready to track records for someone close."
              action={<Button label="Add profile" onPress={() => setShowInvite(true)} />}
            />
          </View>
        ) : (
          members.map((member) => (
            <Row
              key={member.link.id}
              title={member.memberName}
              subtitle={`${member.memberEmail ?? member.memberPhone ?? 'Family member'} · ${ROLE_LABELS[member.link.role]}`}
              right={
                <View style={styles.memberActions}>
                  <Pill label={member.link.status} tone={statusTone(member.link.status)} />
                  {member.link.status !== FamilyLinkStatus.Revoked ? (
                    <Button
                      label="Remove"
                      variant="secondary"
                      onPress={() => confirmRevoke(member.link, member.memberName)}
                      style={styles.removeButton}
                    />
                  ) : null}
                </View>
              }
            />
          ))
        )}
      </Card>

      <Card style={styles.noteCard}>
        <Text style={styles.noteTitle}>Optional setup</Text>
        <Text style={typography.bodySmall}>Roles and advanced permissions can come later.</Text>
      </Card>

      <Modal visible={showInvite} animationType="slide" onRequestClose={() => setShowInvite(false)}>
        <AppScroll contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
          <Text style={typography.h2}>Invite a member</Text>
          <View style={{ marginTop: spacing.md }}>
            <TextField
              label="Their email or phone"
              value={identifier}
              onChangeText={setIdentifier}
              keyboardType="email-address"
              placeholder="Email or phone"
            />
          </View>
          <Button
            label="Send invite"
            loading={inviteMutation.isPending}
            disabled={!identifier.trim()}
            onPress={() => inviteMutation.mutate()}
          />
          <Button label="Cancel" variant="secondary" onPress={() => setShowInvite(false)} />
        </AppScroll>
      </Modal>
    </AppScroll>
  );
}

const styles = StyleSheet.create({
  addButton: { minWidth: 78, minHeight: 38, marginTop: 0, paddingHorizontal: spacing.md },
  currentCard: { backgroundColor: colors.softSurface, borderColor: 'rgba(15,118,110,0.24)' },
  currentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  memberActions: { alignItems: 'flex-end', gap: spacing.xs },
  removeButton: { minHeight: 30, marginTop: 0, paddingHorizontal: spacing.sm },
  noteCard: { backgroundColor: colors.amberBg, borderColor: '#EFD17E' },
  noteTitle: { color: '#744A09', fontSize: 13, fontWeight: '800', marginBottom: 2 },
  emptyFamily: { marginTop: spacing.sm },
});
