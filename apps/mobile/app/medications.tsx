import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {
  AppScroll,
  Button,
  Card,
  EmptyState,
  IconButton,
  ListIcon,
  Pill,
  Row,
  SectionHeader,
  SelectablePill,
  TopBar,
  UploadSourceTile,
} from '../src/components/healthfolio';
import { TextField } from '../src/components/ui';
import {
  dueLabel,
  isDoneToday,
  type CareItemKind,
  type CareReminderScope,
  type CareReminder,
  useCareReminderStore,
} from '../src/lib/care/localCareStore';
import { useProfileStore } from '../src/lib/profile/profileStore';
import { colors, radius, spacing, tapTarget } from '../src/theme/tokens';

const KIND_OPTIONS: ReadonlyArray<{ label: string; value: CareItemKind }> = [
  { label: 'Medicine', value: 'medicine' },
  { label: 'Test', value: 'test' },
  { label: 'Visit', value: 'visit' },
];

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function defaultDate(): string {
  return formatDate(new Date());
}

function dateFromValue(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

function timeFromValue(value: string): Date {
  const [hours, minutes] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(Number.isFinite(hours) ? hours : 9, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return date;
}

function kindIcon(kind: CareItemKind): Parameters<typeof ListIcon>[0]['icon'] {
  if (kind === 'medicine') return 'plus-circle';
  if (kind === 'test') return 'activity';
  return 'calendar';
}

function kindTitle(kind: CareItemKind): string {
  if (kind === 'medicine') return 'Medicine';
  if (kind === 'test') return 'Repeat test';
  return 'Doctor visit';
}

export default function MedicationsScreen() {
  const activeProfileId = useProfileStore((state) => state.activeProfileId);
  const reminders = useCareReminderStore((state) => state.reminders);
  const hydrate = useCareReminderStore((state) => state.hydrate);
  const addReminder = useCareReminderStore((state) => state.addReminder);
  const toggleDoneToday = useCareReminderStore((state) => state.toggleDoneToday);
  const removeReminder = useCareReminderStore((state) => state.removeReminder);

  const [kind, setKind] = useState<CareItemKind>('medicine');
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [time, setTime] = useState('09:00');
  const [nextDate, setNextDate] = useState(defaultDate());
  const [source, setSource] = useState('');
  const [sourceAttachment, setSourceAttachment] = useState('');
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const [pickerValue, setPickerValue] = useState(new Date());
  const careScope = useMemo<CareReminderScope>(
    () => ({ profileId: activeProfileId }),
    [activeProfileId],
  );

  useEffect(() => {
    void hydrate(careScope);
  }, [careScope, hydrate]);

  function resetForm(): void {
    setKind('medicine');
    setTitle('');
    setDetail('');
    setTime('09:00');
    setNextDate(defaultDate());
    setSource('');
    setSourceAttachment('');
  }

  function saveReminder(): void {
    if (!title.trim()) {
      Alert.alert('Missing name', 'Add a medicine, test, or visit name.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) {
      Alert.alert('Invalid date', 'Use YYYY-MM-DD.');
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(time)) {
      Alert.alert('Invalid time', 'Use HH:MM.');
      return;
    }

    void addReminder(
      {
        kind,
        title: title.trim(),
        detail: detail.trim(),
        time,
        nextDate,
        source: [source.trim(), sourceAttachment ? `Source file: ${sourceAttachment}` : '']
          .filter(Boolean)
          .join(' - '),
      },
      careScope,
    );
    resetForm();
  }

  function openDatePicker(): void {
    setPickerValue(dateFromValue(nextDate));
    setPickerMode('date');
  }

  function openTimePicker(): void {
    setPickerValue(timeFromValue(time));
    setPickerMode('time');
  }

  function confirmPicker(): void {
    if (pickerMode === 'date') {
      setNextDate(formatDate(pickerValue));
    }
    if (pickerMode === 'time') {
      setTime(formatTime(pickerValue));
    }
    setPickerMode(null);
  }

  async function pickPrescriptionCamera(): Promise<void> {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.86,
    });

    if (!result.canceled && result.assets[0]) {
      setSourceAttachment(result.assets[0].fileName ?? 'Prescription photo');
    }
  }

  async function pickPrescriptionPhoto(): Promise<void> {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.86,
    });

    if (!result.canceled && result.assets[0]) {
      setSourceAttachment(result.assets[0].fileName ?? 'Prescription photo');
    }
  }

  async function pickPrescriptionFile(): Promise<void> {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets[0]) {
      setSourceAttachment(result.assets[0].name || 'Prescription file');
    }
  }

  function confirmRemove(reminder: CareReminder): void {
    Alert.alert('Remove reminder', `Remove ${reminder.title}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => void removeReminder(reminder.id, careScope),
      },
    ]);
  }

  const sorted = [...reminders].sort((a, b) =>
    `${a.nextDate} ${a.time}`.localeCompare(`${b.nextDate} ${b.time}`),
  );
  const medicineCount = reminders.filter((item) => item.kind === 'medicine').length;
  const followUpCount = reminders.length - medicineCount;

  return (
    <AppScroll>
      <TopBar
        title="Care plan"
        action={
          <IconButton
            icon="arrow-left"
            label="Back"
            variant="secondary"
            onPress={() => router.back()}
          />
        }
      />

      <Card style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <SummaryStat label="Medicines" value={medicineCount} />
          <SummaryStat label="Follow-ups" value={followUpCount} />
          <SummaryStat label="Today" value={reminders.filter(isDoneToday).length} />
        </View>
        <Text style={styles.disclaimer}>
          Reminders organize your own records. They do not change dosage or medical instructions.
        </Text>
      </Card>

      <Card>
        <SectionHeader icon="bell" title="Add reminder" style={styles.cardHeader} />
        <View style={styles.kindRow}>
          {KIND_OPTIONS.map((option) => (
            <SelectablePill
              key={option.value}
              label={option.label}
              selected={kind === option.value}
              onPress={() => setKind(option.value)}
            />
          ))}
        </View>
        <TextField
          label={kind === 'medicine' ? 'Medicine' : kind === 'test' ? 'Test' : 'Visit'}
          value={title}
          onChangeText={setTitle}
          placeholder={kind === 'medicine' ? 'Metformin' : 'CBC / Doctor visit'}
        />
        <TextField
          label="Details"
          value={detail}
          onChangeText={setDetail}
          placeholder="Dose, note, or instruction"
        />
        <View style={styles.inputPair}>
          <PickerField
            label="Date"
            value={nextDate}
            icon="calendar"
            onPress={openDatePicker}
            style={styles.flexInput}
          />
          <PickerField
            label="Time"
            value={time}
            icon="clock"
            onPress={openTimePicker}
            style={styles.flexInput}
          />
        </View>
        <TextField
          label="Source"
          value={source}
          onChangeText={setSource}
          placeholder="Prescription or doctor note"
        />
        {kind === 'medicine' ? (
          <View style={styles.sourceAttach}>
            <View style={styles.sourceAttachHeader}>
              <Text style={styles.sourceAttachLabel}>Prescription source</Text>
              {sourceAttachment ? <Pill label="Attached" tone="blue" /> : null}
            </View>
            <View style={styles.sourceTiles}>
              <UploadSourceTile
                code="CAM"
                label="Camera"
                icon={<Feather name="camera" size={16} color="#FFFFFF" />}
                onPress={() => void pickPrescriptionCamera()}
              />
              <UploadSourceTile
                code="IMG"
                label="Photo"
                icon={<Feather name="image" size={16} color="#FFFFFF" />}
                onPress={() => void pickPrescriptionPhoto()}
              />
              <UploadSourceTile
                code="FILE"
                label="File"
                icon={<Feather name="file-text" size={16} color="#FFFFFF" />}
                onPress={() => void pickPrescriptionFile()}
              />
            </View>
            {sourceAttachment ? (
              <Text numberOfLines={1} style={styles.sourceAttachment}>
                {sourceAttachment}
              </Text>
            ) : (
              <Text style={styles.sourceAttachCopy}>
                Optional. OCR review comes in the next round.
              </Text>
            )}
          </View>
        ) : null}
        <Button label="Save reminder" onPress={saveReminder} />
      </Card>

      <Card>
        <SectionHeader icon="clock" title="Upcoming" style={styles.cardHeader} />
        {sorted.length === 0 ? (
          <EmptyState icon="bell" title="No reminders" body="Add medicines, tests, or visits." />
        ) : (
          sorted.map((reminder) => (
            <Row
              key={reminder.id}
              left={<ListIcon icon={kindIcon(reminder.kind)} />}
              title={reminder.title}
              subtitle={[kindTitle(reminder.kind), reminder.detail, dueLabel(reminder)]
                .filter(Boolean)
                .join(' - ')}
              right={
                <View style={styles.rowActions}>
                  <Pill
                    label={isDoneToday(reminder) ? 'Done' : 'Due'}
                    tone={isDoneToday(reminder) ? 'green' : 'amber'}
                  />
                  <Feather name="trash-2" size={18} color={colors.danger} />
                </View>
              }
              onPress={() => void toggleDoneToday(reminder.id, careScope)}
            />
          ))
        )}
      </Card>

      {sorted.length > 0 ? (
        <Button
          label="Remove oldest"
          variant="secondary"
          onPress={() => confirmRemove(sorted[sorted.length - 1])}
        />
      ) : null}

      <Modal
        visible={pickerMode !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerMode(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.dateSheet}>
            <Text style={styles.sheetTitle}>
              {pickerMode === 'date' ? 'Reminder date' : 'Reminder time'}
            </Text>
            <DateTimePicker
              value={pickerValue}
              mode={pickerMode === 'time' ? 'time' : 'date'}
              display="spinner"
              minuteInterval={5}
              minimumDate={pickerMode === 'date' ? new Date() : undefined}
              onChange={(_, selectedDate) => {
                if (selectedDate) setPickerValue(selectedDate);
              }}
              style={styles.datePicker}
            />
            <View style={styles.sheetActions}>
              <Button
                label="Cancel"
                variant="secondary"
                onPress={() => setPickerMode(null)}
                style={styles.sheetButton}
              />
              <Button label="Done" onPress={confirmPicker} style={styles.sheetButton} />
            </View>
          </View>
        </View>
      </Modal>
    </AppScroll>
  );
}

function PickerField({
  label,
  value,
  icon,
  onPress,
  style,
}: {
  label: string;
  value: string;
  icon: ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.pickerGroup, style]}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Select ${label.toLowerCase()}`}
        onPress={onPress}
        style={styles.pickerField}
      >
        <Text style={styles.pickerValue}>{value}</Text>
        <Feather name={icon} size={17} color={colors.primary} />
      </Pressable>
    </View>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryStat}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryCard: { backgroundColor: colors.blueBg },
  summaryRow: { flexDirection: 'row', gap: spacing.sm },
  summaryStat: {
    flex: 1,
    minHeight: 68,
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.sm,
  },
  summaryValue: { color: colors.textPrimary, fontSize: 22, lineHeight: 27, fontWeight: '700' },
  summaryLabel: { color: colors.textSecondary, fontSize: 11, lineHeight: 15, fontWeight: '700' },
  disclaimer: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: spacing.md },
  cardHeader: { marginTop: 0 },
  kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  inputPair: { flexDirection: 'row', gap: spacing.sm },
  flexInput: { flex: 1 },
  pickerGroup: { marginBottom: spacing.md },
  pickerLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  pickerField: {
    minHeight: tapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderWidth: 0,
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceInset,
  },
  pickerValue: {
    color: colors.textPrimary,
    fontSize: 14,
  },
  sourceAttach: {
    borderRadius: 20,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  sourceAttachHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sourceAttachLabel: {
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  sourceTiles: { gap: spacing.sm },
  sourceAttachment: {
    color: colors.primary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  sourceAttachCopy: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing.sm,
  },
  rowActions: { alignItems: 'flex-end', gap: spacing.xs },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(17,24,29,0.38)',
  },
  dateSheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  sheetTitle: { color: colors.textPrimary, fontSize: 16, lineHeight: 21, fontWeight: '700' },
  datePicker: { height: 216 },
  sheetActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  sheetButton: { flex: 1, marginTop: 0 },
});
