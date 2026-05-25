import { BloodGroup } from '@medical-tracker/shared-types';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Subtitle, TextField, Title } from '../../../src/components/ui';
import { updateHealthProfile, updateMe } from '../../../src/lib/api/endpoints';
import { colors, radius, spacing } from '../../../src/theme/tokens';

const BLOOD_GROUPS = Object.values(BloodGroup);

function ChipsInput({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState('');
  function add(): void {
    const v = draft.trim();
    if (v && !items.includes(v)) onChange([...items, v]);
    setDraft('');
  }
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chipRow}>
        {items.map((item) => (
          <Pressable key={item} onPress={() => onChange(items.filter((i) => i !== item))} style={styles.chip}>
            <Text style={styles.chipText}>{item} ✕</Text>
          </Pressable>
        ))}
      </View>
      <TextField value={draft} onChangeText={setDraft} placeholder={placeholder} onSubmitEditing={add} returnKeyType="done" />
    </View>
  );
}

export default function HealthProfile() {
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | null>(null);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [conditions, setConditions] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [medications, setMedications] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function save(skip: boolean): Promise<void> {
    setLoading(true);
    try {
      if (!skip) {
        if (bloodGroup) await updateMe({ bloodGroup });
        await updateHealthProfile({
          height: height ? Number(height) : null,
          weight: weight ? Number(weight) : null,
          knownConditions: conditions,
          allergies,
          currentMedications: medications,
        });
      }
      router.replace('/(tabs)/home');
    } catch {
      router.replace('/(tabs)/home');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} style={{ backgroundColor: colors.background }}>
      <Title>Health profile</Title>
      <Subtitle>Optional, but it improves alerts and ranges. You can skip and add later.</Subtitle>

      <Text style={styles.label}>Blood group</Text>
      <View style={styles.chipRow}>
        {BLOOD_GROUPS.map((bg) => {
          const active = bg === bloodGroup;
          return (
            <Pressable
              key={bg}
              onPress={() => setBloodGroup(active ? null : bg)}
              style={[styles.chip, active ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{bg}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <TextField label="Height (cm)" value={height} onChangeText={setHeight} keyboardType="numeric" placeholder="170" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Weight (kg)" value={weight} onChangeText={setWeight} keyboardType="numeric" placeholder="65" />
        </View>
      </View>

      <ChipsInput label="Known conditions" items={conditions} onChange={setConditions} placeholder="Add a condition + enter" />
      <ChipsInput label="Allergies" items={allergies} onChange={setAllergies} placeholder="Add an allergy + enter" />
      <ChipsInput label="Current medications" items={medications} onChange={setMedications} placeholder="Add a medication + enter" />

      <Button label="Save & continue" onPress={() => void save(false)} loading={loading} />
      <Button label="Skip for now" variant="secondary" onPress={() => void save(true)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingTop: spacing.xl * 2 },
  label: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { color: colors.textPrimary, fontSize: 14 },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },
});
