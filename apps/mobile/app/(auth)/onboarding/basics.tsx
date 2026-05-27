import DateTimePicker from '@react-native-community/datetimepicker';
import { Sex, UnitsPreference } from '@medical-tracker/shared-types';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  AppScroll,
  Button,
  Card,
  ProgressBar,
  typography,
} from '../../../src/components/healthfolio';
import { Segmented, TextField } from '../../../src/components/ui';
import { updateMe } from '../../../src/lib/api/endpoints';
import { useOnboardingDraftStore } from '../../../src/lib/onboarding/draftStore';
import { hasSupabaseSession } from '../../../src/lib/supabase/auth';
import { colors, radius, spacing, tapTarget } from '../../../src/theme/tokens';

export default function Basics() {
  const { mode } = useLocalSearchParams<{ mode?: 'signup' }>();
  const setBasicDetails = useOnboardingDraftStore((s) => s.setBasicDetails);
  const [name, setName] = useState('');
  const [dob, setDob] = useState<Date | null>(null);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [sex, setSex] = useState<Sex | null>(null);
  const [otherGender, setOtherGender] = useState('');
  const [units, setUnits] = useState<UnitsPreference>(UnitsPreference.Metric);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fallbackDob = new Date(2000, 0, 1);

  function parseDob(): Date | null {
    if (!dob || dob > new Date()) return null;
    return new Date(Date.UTC(dob.getFullYear(), dob.getMonth(), dob.getDate()));
  }

  function formatDob(date: Date): string {
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async function submit(): Promise<void> {
    const parsedDob = parseDob();
    if (!name.trim() || !parsedDob || !sex) {
      setError('Please complete name, date of birth, and gender.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const details = {
        name: name.trim(),
        dob: parsedDob.toISOString(),
        sex,
        unitsPreference: units,
      };

      if (mode === 'signup' && !(await hasSupabaseSession())) {
        setBasicDetails(details);
        router.push('/(auth)/onboarding/health?mode=signup');
        return;
      }

      await updateMe(details);
      router.push('/(auth)/onboarding/health');
    } catch {
      setError('Could not save. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppScroll contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <Text style={typography.eyebrow}>Step 1 of 3</Text>
      <ProgressBar value={0.34} />
      <Card>
        <Text style={typography.h2}>Health profile</Text>
        <Text style={[typography.body, { marginTop: spacing.xs }]}>
          Only the basics needed for a clean summary.
        </Text>
      </Card>

      <TextField label="Full name" value={name} onChangeText={setName} placeholder="Full name" />

      <View style={styles.dateGroup}>
        <Text style={styles.label}>Date of birth</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Select date of birth"
          onPress={() => setShowDobPicker(true)}
          style={styles.dateField}
        >
          <Text style={[styles.dateText, !dob && styles.datePlaceholder]}>
            {dob ? formatDob(dob) : 'Select date'}
          </Text>
          <Feather name="calendar" size={17} color={colors.textSecondary} />
        </Pressable>
      </View>

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

      {sex === Sex.Other ? (
        <TextField
          label="Other gender"
          value={otherGender}
          onChangeText={setOtherGender}
          placeholder=""
        />
      ) : null}

      <Segmented
        label="Unit preference"
        value={units}
        onChange={setUnits}
        options={[
          { label: 'Metric', value: UnitsPreference.Metric },
          { label: 'Imperial', value: UnitsPreference.Imperial },
        ]}
      />

      {error ? (
        <Text style={{ color: colors.danger, marginBottom: spacing.sm }}>{error}</Text>
      ) : null}
      <Button label="Continue" onPress={() => void submit()} loading={loading} />

      <Modal
        animationType="slide"
        transparent
        visible={showDobPicker}
        onRequestClose={() => setShowDobPicker(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.dateSheet}>
            <Text style={styles.sheetTitle}>Date of birth</Text>
            <DateTimePicker
              value={dob ?? fallbackDob}
              mode="date"
              display="spinner"
              style={styles.datePicker}
              maximumDate={new Date()}
              minimumDate={new Date(1900, 0, 1)}
              onChange={(_, selectedDate) => {
                if (selectedDate) setDob(selectedDate);
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
                  setDob((current) => current ?? fallbackDob);
                  setShowDobPicker(false);
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

const styles = StyleSheet.create({
  dateGroup: { marginBottom: spacing.md },
  label: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs },
  dateField: {
    minHeight: tapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  dateText: { color: colors.textPrimary, fontSize: 14 },
  datePlaceholder: { color: colors.textSecondary },
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
  datePicker: { height: 216 },
  sheetTitle: { color: colors.textPrimary, fontSize: 16, lineHeight: 21, fontWeight: '800' },
  sheetActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  sheetButton: { flex: 1, marginTop: 0 },
});
