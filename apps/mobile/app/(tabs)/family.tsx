import type {
  FamilyLink,
  FamilyMemberView,
} from '@medical-tracker/shared-types';
import { FamilyLinkStatus, FamilyRole } from '@medical-tracker/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button, TextField } from '../../src/components/ui';
import {
  acceptInvite,
  inviteMember,
  listFamilyMembers,
  revokeFamilyLink,
} from '../../src/lib/api/endpoints';
import { colors, radius, spacing } from '../../src/theme/tokens';

const ROLE_LABELS: Record<FamilyRole, string> = {
  [FamilyRole.Viewer]: 'Viewer',
  [FamilyRole.Contributor]: 'Contributor',
  [FamilyRole.Guardian]: 'Guardian',
};

const STATUS_COLORS: Record<FamilyLinkStatus, string> = {
  [FamilyLinkStatus.Pending]: '#F4B400',
  [FamilyLinkStatus.Active]: colors.rangeNormal,
  [FamilyLinkStatus.Declined]: colors.danger,
  [FamilyLinkStatus.Revoked]: colors.textSecondary,
};

export default function FamilyScreen() {
  const qc = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [showAccept, setShowAccept] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [inviteToken, setInviteToken] = useState('');

  const { data: members, isLoading } = useQuery<FamilyMemberView[]>({
    queryKey: ['family', 'members'],
    queryFn: listFamilyMembers,
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      inviteMember({ memberIdentifier: identifier, role: FamilyRole.Viewer }),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ['family'] });
      setShowInvite(false);
      setIdentifier('');
      Alert.alert(
        'Invite sent',
        `Share this token with ${identifier}:\n\n${res.inviteToken}`,
      );
    },
  });

  const acceptMutation = useMutation({
    mutationFn: () => acceptInvite({ inviteToken }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['family'] });
      setShowAccept(false);
      setInviteToken('');
      Alert.alert('Joined!', 'You now have access to their health data.');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeFamilyLink(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['family'] }),
  });

  function confirmRevoke(link: FamilyLink, name: string): void {
    Alert.alert('Remove member', `Remove ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => revokeMutation.mutate(link.id),
      },
    ]);
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
    >
      {/* Actions */}
      <View style={styles.actionRow}>
        <Button label="+ Invite member" onPress={() => setShowInvite(true)} />
        <Button
          label="Join with token"
          variant="secondary"
          onPress={() => setShowAccept(true)}
        />
      </View>

      {/* Member list */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>People with access to my data</Text>
        {isLoading ? (
          <Text style={styles.dimText}>Loading…</Text>
        ) : !members || members.length === 0 ? (
          <Text style={styles.dimText}>No members yet.</Text>
        ) : (
          members.map((m) => (
            <View key={m.link.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{m.memberName}</Text>
                <Text style={styles.memberSub}>
                  {m.memberEmail ?? m.memberPhone ?? ''}
                </Text>
                <Text style={[styles.statusBadge, { color: STATUS_COLORS[m.link.status] }]}>
                  {m.link.status.toUpperCase()} · {ROLE_LABELS[m.link.role]}
                </Text>
              </View>
              {m.link.status !== FamilyLinkStatus.Revoked && (
                <Pressable
                  onPress={() => confirmRevoke(m.link, m.memberName)}
                  style={styles.revokeBtn}
                  accessibilityLabel="Remove member"
                >
                  <Text style={styles.revokeBtnText}>✕</Text>
                </Pressable>
              )}
            </View>
          ))
        )}
      </View>

      {/* Invite modal */}
      <Modal visible={showInvite} animationType="slide" onRequestClose={() => setShowInvite(false)}>
        <ScrollView
          style={{ backgroundColor: colors.background }}
          contentContainerStyle={styles.container}
        >
          <Text style={styles.modalTitle}>Invite a member</Text>
          <TextField
            label="Their email or phone"
            value={identifier}
            onChangeText={setIdentifier}
            keyboardType="email-address"
            placeholder="user@example.com"
          />
          <Button
            label="Send invite"
            loading={inviteMutation.isPending}
            disabled={!identifier.trim()}
            onPress={() => inviteMutation.mutate()}
          />
          <Button label="Cancel" variant="secondary" onPress={() => setShowInvite(false)} />
        </ScrollView>
      </Modal>

      {/* Accept modal */}
      <Modal visible={showAccept} animationType="slide" onRequestClose={() => setShowAccept(false)}>
        <ScrollView
          style={{ backgroundColor: colors.background }}
          contentContainerStyle={styles.container}
        >
          <Text style={styles.modalTitle}>Join with invite token</Text>
          <TextField
            label="Invite token"
            value={inviteToken}
            onChangeText={setInviteToken}
            placeholder="Paste token here"
          />
          <Button
            label="Accept invite"
            loading={acceptMutation.isPending}
            disabled={!inviteToken.trim()}
            onPress={() => acceptMutation.mutate()}
          />
          <Button label="Cancel" variant="secondary" onPress={() => setShowAccept(false)} />
        </ScrollView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  actionRow: { gap: spacing.sm, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  dimText: { fontSize: 14, color: colors.textSecondary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  memberName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  memberSub: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  statusBadge: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  revokeBtn: { padding: spacing.xs },
  revokeBtnText: { fontSize: 14, color: colors.textSecondary },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.lg,
    marginTop: spacing.xl,
  },
});
