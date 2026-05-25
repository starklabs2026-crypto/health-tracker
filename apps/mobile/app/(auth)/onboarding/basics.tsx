import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Sex, UnitsPreference } from '@medical-tracker/shared-types';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { Button, Screen, Segmented, Subtitle, TextField, Title } from '../../../src/components/ui';
import { updateMe } from '../../../src/lib/api/endpoints';
import { colors, radius, spacing, tapTarget } from '../../../src/theme/tokens';

export default function Basics() {
  const [name, setName] = useState('');
  const [dob, setDob] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [sex, setSex] = useState<Sex | null>(null);
  const [units, setUnits] = useState<UnitsPreference>(UnitsPreference.Metric);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function onPickDate(_e: DateTimePickerEvent, selected?: Date): void {
    if (Platform.OS !== 'ios') setShowPicker(false);
    if (selected) setDob(selected);
  }

  async function submit(): Promise<void> {
    if (!name.trim() || !dob || !sex) {
      setError('Please complete name, date of birth, and sex.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await updateMe({
        name: name.trim(),
        dob: dob.toISOString(),
        sex,
        unitsPreference: units,
      });
      router.push('/(auth)/onboarding/health');
    } catch {
      setError('Could not save. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Title>About you</Title>
      <Subtitle>This helps us calculate accurate reference ranges.</Subtitle>

      <TextField label="Full name" value={name} onChangeText={setName} placeholder="Jane Doe" />

      <View style={{ marginBottom: spacing.md }}>
        <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: spacing.xs }}>
          Date of birth
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Select date of birth"
          onPress={() => setShowPicker(true)}
          style={{
            minHeight: tapTarget,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.input,
            justifyContent: 'center',
            paddingHorizontal: spacing.md,
            backgroundColor: colors.surface,
          }}
        >
          <Text style={{ fontSize: 16, color: dob ? colors.textPrimary : colors.textSecondary }}>
            {dob ? dob.toLocaleDateString() : 'Select date'}
          </Text>
        </Pressable>
        {showPicker ? (
          <DateTimePicker
            value={dob ?? new Date(2000, 0, 1)}
            mode="date"
            maximumDate={new Date()}
            onChange={onPickDate}
          />
        ) : null}
      </View>

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

      {error ? <Text style={{ color: colors.danger, marginBottom: spacing.sm }}>{error}</Text> : null}
      <Button label="Continue" onPress={() => void submit()} loading={loading} />
    </Screen>
  );
}
