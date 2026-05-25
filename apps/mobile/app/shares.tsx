import type { DoctorShare } from '@medical-tracker/shared-types';
import { ShareExpiry } from '@medical-tracker/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button, TextField } from '../src/components/ui';
import { createShare, listShares, revokeShare } from '../src/lib/api/endpoints';
import { colors, radius, spacing } from '../src/theme/tokens';

const EXPIRY_OPTIONS = [
  { label: '1 hour', value: ShareExpiry.OneHour },
  { label: '1 day', value: ShareExpiry.OneDay },
  { label: '1 week', value: ShareExpiry.OneWeek },
  { label: '30 days', value: ShareExpiry.OneMonth },
];

export default function SharesScreen() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0] ?? '');
  const [expiry, setExpiry] = useState<ShareExpiry>(ShareExpiry.OneWeek);
  const [note, setNote] = useState('');
  const [singleUse, setSingleUse] = useState(false);

  const { data: shares, isLoading } = useQuery<DoctorShare[]>({
    queryKey: ['shares'],
    queryFn: listShares,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createShare({
        dateRangeStart: dateFrom,
        dateRangeEnd: dateTo,
        expiry,
        singleUse,
        customNote: note.trim() || undefined,
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
    setDateFrom('');
    setDateTo(new Date().toISOString().split('T')[0] ?? '');
    setExpiry(ShareExpiry.OneWeek);
    setNote('');
    setSingleUse(false);
  }

  function confirmRevoke(share: DoctorShare) {
    Alert.alert('Revoke share', 'The doctor will no longer be able to access this link.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Revoke', style: 'destructive', onPress: () => revokeMutation.mutate(share.id) },
    ]);
  }

  const active = (shares ?? []).filter((s) => !s.revokedAt && new Date(s.expiresAt) > new Date());

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Button label="+ New share link" onPress={() => setShowCreate(true)} />

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Active share links</Text>
        {isLoading ? (
          <Text style={styles.dimText}>Loading…</Text>
        ) : active.length === 0 ? (
          <Text style={styles.dimText}>No active share links.</Text>
        ) : (
          active.map((s) => (
            <View key={s.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowDate}>
                  {new Date(s.dateRangeStart).toLocaleDateString()} –{' '}
                  {new Date(s.dateRangeEnd).toLocaleDateString()}
                </Text>
                <Text style={styles.rowExpiry}>
                  Expires {new Date(s.expiresAt).toLocaleString()}
                  {s.singleUse ? '  ·  Single use' : ''}
                </Text>
                {s.customNote ? (
                  <Text style={styles.rowNote} numberOfLines={1}>{s.customNote}</Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => confirmRevoke(s)}
                style={styles.revokeBtn}
                accessibilityLabel="Revoke share"
              >
                <Text style={styles.revokeBtnText}>Revoke</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>

      {/* Create modal */}
      <Modal visible={showCreate} animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
          <Text style={styles.modalTitle}>New share link</Text>

          <TextField
            label="Date from (YYYY-MM-DD)"
            value={dateFrom}
            onChangeText={setDateFrom}
            placeholder="2024-01-01"
            keyboardType="numeric"
          />
          <TextField
            label="Date to (YYYY-MM-DD)"
            value={dateTo}
            onChangeText={setDateTo}
            placeholder="2024-12-31"
            keyboardType="numeric"
          />

          <Text style={styles.fieldLabel}>Expiry</Text>
          <View style={styles.expiryRow}>
            {EXPIRY_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                style={[styles.expiryChip, expiry === opt.value && styles.expiryChipActive]}
                onPress={() => setExpiry(opt.value)}
              >
                <Text style={[styles.expiryChipText, expiry === opt.value && styles.expiryChipTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.fieldLabel}>Single use (auto-revoke after first view)</Text>
            <Pressable
              style={[styles.toggle, singleUse && styles.toggleOn]}
              onPress={() => setSingleUse(!singleUse)}
            >
              <Text style={styles.toggleText}>{singleUse ? 'ON' : 'OFF'}</Text>
            </Pressable>
          </View>

          <TextField
            label="Note for doctor (optional)"
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Please review CBC results"
          />

          <Button
            label="Create link"
            loading={createMutation.isPending}
            disabled={!dateFrom || !dateTo}
            onPress={() => createMutation.mutate()}
          />
          <Button label="Cancel" variant="secondary" onPress={() => { setShowCreate(false); resetForm(); }} />
        </ScrollView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  dimText: { fontSize: 14, color: colors.textSecondary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowDate: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  rowExpiry: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  rowNote: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', marginTop: 2 },
  revokeBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  revokeBtnText: { fontSize: 13, color: colors.danger, fontWeight: '600' },
  modalTitle: { fontSize: 22, fontWeight: '700', color: colors.primary, marginBottom: spacing.lg, marginTop: spacing.xl },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.sm },
  expiryRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.sm },
  expiryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  expiryChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  expiryChipText: { fontSize: 13, color: colors.textSecondary },
  expiryChipTextActive: { color: '#fff', fontWeight: '600' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  toggle: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  toggleOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
});
