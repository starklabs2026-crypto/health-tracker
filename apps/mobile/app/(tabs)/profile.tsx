import { Sex, UnitsPreference } from '@medical-tracker/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Modal, StyleSheet, Switch, Text, View } from 'react-native';

import { AppScroll, Avatar, Button, Card, LoadingScreen, Pill, Row, TopBar, typography } from '../../src/components/healthfolio';
import { Segmented, TextField } from '../../src/components/ui';
import { createPdfExportUrl, getMe, pairBiometric, updateMe } from '../../src/lib/api/endpoints';
import { useAuthStore } from '../../src/lib/auth/authStore';
import { signOut } from '../../src/lib/auth/session';
import { colors, spacing } from '../../src/theme/tokens';

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
  const exportMutation = useMutation({
    mutationFn: () => createPdfExportUrl(),
    onSuccess: async ({ downloadUrl }) => {
      await Linking.openURL(downloadUrl);
    },
    onError: () => {
      Alert.alert('Export failed', 'Could not create the PDF export. Please try again.');
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
    return <LoadingScreen />;
  }

  const { user } = data;

  return (
    <AppScroll>
      <TopBar eyebrow="Account" title="Profile" action={<Avatar label={user.name || 'Me'} />} />

      <Card>
        <View style={styles.identityRow}>
          <View>
            <Text style={styles.name}>{user.name || 'Unnamed profile'}</Text>
            <Text style={typography.bodySmall}>{user.email ?? user.phone ?? 'No email on file'}</Text>
          </View>
          <Button label="Edit" variant="secondary" onPress={openEdit} style={styles.editButton} />
        </View>
      </Card>

      <Card>
        <Text style={typography.h3}>Health profile</Text>
        <Row title="Date of birth" subtitle={user.dob ? new Date(user.dob).toLocaleDateString() : 'Not set'} />
        <Row title="Gender" subtitle={user.sex ?? 'Not specified'} />
        <Row title="Blood group" subtitle={user.bloodGroup ?? 'Add'} />
        <Row title="Units" subtitle={user.unitsPreference ?? 'Metric'} />
      </Card>

      <Card>
        <View style={styles.switchRow}>
          <View>
            <Text style={styles.rowTitle}>Biometric lock</Text>
            <Text style={typography.bodySmall}>Require device unlock.</Text>
          </View>
          <Switch
            value={biometric}
            onValueChange={(value) => void onToggleBiometric(value)}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>
        <Row
          title="Export PDF"
          subtitle={exportMutation.isPending ? 'Creating secure download...' : 'Confirmed readings and document metadata.'}
          right={<Pill label={exportMutation.isPending ? 'Working' : 'Start'} />}
          onPress={() => exportMutation.mutate()}
        />
        <Row
          title="Share with doctor"
          subtitle="Create a temporary doctor link."
          right={<Pill label="Open" tone="blue" />}
          onPress={() => router.push('/shares')}
        />
        <Button label="Sign out" variant="danger" onPress={() => void onSignOut()} />
      </Card>

      <Modal visible={editing} animationType="slide" onRequestClose={() => setEditing(false)}>
        <AppScroll contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
          <Text style={typography.h2}>Edit profile</Text>
          <View style={{ marginTop: spacing.md }}>
            <TextField label="Full name" value={name} onChangeText={setName} />
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
          <Button
            label="Save"
            loading={mutation.isPending}
            onPress={() => mutation.mutate({ name: name.trim(), ...(sex ? { sex } : {}), unitsPreference: units })}
          />
          <Button label="Cancel" variant="secondary" onPress={() => setEditing(false)} />
        </AppScroll>
      </Modal>
    </AppScroll>
  );
}

const styles = StyleSheet.create({
  identityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  name: { color: colors.textPrimary, fontSize: 14, fontWeight: '800' },
  editButton: { minHeight: 32, width: 68, marginTop: 0 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  rowTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '800' },
});
