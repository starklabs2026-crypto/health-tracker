import { Sex, UnitsPreference } from '@medical-tracker/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Button, Segmented, TextField } from '../../src/components/ui';
import { getMe, pairBiometric, updateMe } from '../../src/lib/api/endpoints';
import { useAuthStore } from '../../src/lib/auth/authStore';
import { signOut } from '../../src/lib/auth/session';
import { colors, radius, spacing } from '../../src/theme/tokens';

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value && value.length > 0 ? value : '—'}</Text>
    </View>
  );
}

export default function Profile() {
  const qc = useQueryClient();
  const setUnlocked = useAuthStore((s) => s.setUnlocked);
  const { data, isLoading } = useQuery({ queryKey: ['me'], queryFn: getMe });

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [units, setUnits] = useState<UnitsPreference>(UnitsPreference.Metric);
  const [biometric, setBiometric] = useState(false);

  const mutation = useMutation({
    mutationFn: updateMe,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['me'] });
      setEditing(false);
    },
  });

  function openEdit(): void {
    if (!data) return;
    setName(data.user.name);
    setSex(data.user.sex);
    setUnits(data.user.unitsPreference);
    setEditing(true);
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

  if (isLoading || !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const { user, healthProfile } = data;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Basics</Text>
          <Button label="Edit" variant="secondary" onPress={openEdit} />
        </View>
        <Row label="Name" value={user.name} />
        <Row label="Email" value={user.email} />
        <Row label="Phone" value={user.phone} />
        <Row label="Date of birth" value={user.dob ? new Date(user.dob).toLocaleDateString() : null} />
        <Row label="Sex" value={user.sex} />
        <Row label="Units" value={user.unitsPreference} />
        <Row label="Blood group" value={user.bloodGroup} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Health profile</Text>
        <Row label="Height" value={healthProfile?.height ? `${healthProfile.height} cm` : null} />
        <Row label="Weight" value={healthProfile?.weight ? `${healthProfile.weight} kg` : null} />
        <Row label="Conditions" value={healthProfile?.knownConditions.join(', ') ?? null} />
        <Row label="Allergies" value={healthProfile?.allergies.join(', ') ?? null} />
        <Row label="Medications" value={healthProfile?.currentMedications.join(', ') ?? null} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Security</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Biometric unlock</Text>
          <Switch value={biometric} onValueChange={(v) => void onToggleBiometric(v)} />
        </View>
      </View>

      <Button
        label="Share with doctor"
        variant="secondary"
        onPress={() => router.push('/shares')}
      />

      <Button label="Sign out" variant="danger" onPress={() => void onSignOut()} />

      <Modal visible={editing} animationType="slide" onRequestClose={() => setEditing(false)}>
        <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
          <Text style={styles.modalTitle}>Edit basics</Text>
          <TextField label="Full name" value={name} onChangeText={setName} />
          <Segmented
            label="Sex"
            value={sex}
            onChange={setSex}
            options={[
              { label: 'Male', value: Sex.Male },
              { label: 'Female', value: Sex.Female },
              { label: 'Other', value: Sex.Other },
            ]}
          />
          <Segmented
            label="Units"
            value={units}
            onChange={setUnits}
            options={[
              { label: 'Metric', value: UnitsPreference.Metric },
              { label: 'Imperial', value: UnitsPreference.Imperial },
            ]}
          />
          <Button
            label="Save"
            loading={mutation.isPending}
            onPress={() =>
              mutation.mutate({ name: name.trim(), ...(sex ? { sex } : {}), unitsPreference: units })
            }
          />
          <Button label="Cancel" variant="secondary" onPress={() => setEditing(false)} />
        </ScrollView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.primary, marginBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
  rowLabel: { fontSize: 14, color: colors.textSecondary },
  rowValue: { fontSize: 15, color: colors.textPrimary, flexShrink: 1, textAlign: 'right', marginLeft: spacing.md },
  modalTitle: { fontSize: 22, fontWeight: '700', color: colors.primary, marginBottom: spacing.lg, marginTop: spacing.xl },
});
