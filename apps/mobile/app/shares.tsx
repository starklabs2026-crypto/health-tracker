import type { DoctorShare } from '@medical-tracker/shared-types';
import { ShareExpiry } from '@medical-tracker/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { AppScroll, Button, Card, HeroCard, Pill, Row, TopBar, typography } from '../src/components/healthfolio';
import { TextField } from '../src/components/ui';
import { createShare, listShares, revokeShare } from '../src/lib/api/endpoints';
import { colors, spacing } from '../src/theme/tokens';

const EXPIRY_OPTIONS = [
  { label: '24 hr', value: ShareExpiry.OneDay },
  { label: '7 days', value: ShareExpiry.OneWeek },
  { label: '30 days', value: ShareExpiry.OneMonth },
];

export default function SharesScreen() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expiry, setExpiry] = useState<ShareExpiry>(ShareExpiry.OneWeek);
  const [note, setNote] = useState('');
  const [singleUse, setSingleUse] = useState(true);

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
    setDateTo('');
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

  const active = (shares ?? []).filter((share) => !share.revokedAt && new Date(share.expiresAt) > new Date());

  return (
    <AppScroll>
      <TopBar
        eyebrow="Doctor access"
        title="Share summary"
        action={<Button label="New" onPress={() => setShowCreate(true)} style={styles.newButton} />}
      />
      <HeroCard tone="dark">
        <Text style={[typography.h3, { color: '#FFFFFF' }]}>Temporary read-only link</Text>
        <Text style={[typography.bodySmall, { color: 'rgba(255,255,255,0.78)', marginTop: spacing.xs }]}>
          Confirmed readings for selected date range.
        </Text>
      </HeroCard>

      <Card>
        <Text style={typography.h3}>Active share links</Text>
        {isLoading ? (
          <Text style={[typography.body, { marginTop: spacing.sm }]}>Loading...</Text>
        ) : active.length === 0 ? (
          <Text style={[typography.body, { marginTop: spacing.sm }]}>No active share links.</Text>
        ) : (
          active.map((share) => (
            <Row
              key={share.id}
              title={`${new Date(share.dateRangeStart).toLocaleDateString()} to ${new Date(share.dateRangeEnd).toLocaleDateString()}`}
              subtitle={`Expires ${new Date(share.expiresAt).toLocaleString()}${share.singleUse ? ' · Single use' : ''}`}
              right={
                <Pressable onPress={() => confirmRevoke(share)}>
                  <Text style={styles.revokeText}>Revoke</Text>
                </Pressable>
              }
            />
          ))
        )}
      </Card>

      <Modal visible={showCreate} animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <AppScroll contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
          <Text style={typography.h2}>Create share link</Text>
          <Text style={[typography.body, { marginTop: spacing.xs, marginBottom: spacing.md }]}>
            Share confirmed readings in a temporary doctor view.
          </Text>
          <TextField
            label="Date from (YYYY-MM-DD)"
            value={dateFrom}
            onChangeText={setDateFrom}
            placeholder="YYYY-MM-DD"
            keyboardType="numeric"
          />
          <TextField
            label="Date to (YYYY-MM-DD)"
            value={dateTo}
            onChangeText={setDateTo}
            placeholder="YYYY-MM-DD"
            keyboardType="numeric"
          />
          <Text style={styles.label}>Expiry</Text>
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
          <Row
            title="Single-use link"
            subtitle="Expires after first view."
            right={<Pill label={singleUse ? 'On' : 'Off'} tone={singleUse ? 'active' : 'neutral'} />}
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
    </AppScroll>
  );
}

const styles = StyleSheet.create({
  newButton: { minWidth: 78, minHeight: 38, marginTop: 0, paddingHorizontal: spacing.md },
  revokeText: { color: colors.danger, fontSize: 12, fontWeight: '800' },
  label: { color: colors.textSecondary, fontSize: 13, fontWeight: '800', marginBottom: spacing.xs },
  expiryRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  expiryChip: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  expiryChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  expiryChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '800' },
  expiryChipTextActive: { color: '#FFFFFF' },
});
