import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import { DocType } from '@medical-tracker/shared-types';
import { useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  AppScroll,
  Button,
  Card,
  CenteredScreen,
  HeroCard,
  TopBar,
  UploadSourceTile,
  typography,
} from '../../src/components/healthfolio';
import { TextField } from '../../src/components/ui';
import { createDocument, markUploaded, uploadToPresignedUrl } from '../../src/lib/api/endpoints';
import { colors, radius, spacing, tapTarget } from '../../src/theme/tokens';

type Step = 'pick' | 'form' | 'uploading';

interface PickedFile {
  uri: string;
  mimeType: string;
  size: number;
}

const DOC_TYPE_OPTIONS: { label: string; value: DocType }[] = [
  { label: 'Lab report', value: DocType.LabReport },
  { label: 'Prescription', value: DocType.Prescription },
  { label: 'Imaging report', value: DocType.ImagingReport },
  { label: 'Discharge summary', value: DocType.DischargeSummary },
  { label: 'Vaccination record', value: DocType.VaccinationRecord },
  { label: 'Other', value: DocType.Other },
];

function uploadErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (!message) return 'Upload failed. Please check your connection and try again.';
  if (message.includes('selected file was empty')) return message;
  if (message.includes('OCR supports')) return 'OCR supports PDF, JPG, and PNG files right now.';
  if (message.includes('OPENAI_API_KEY')) return 'OCR is not configured on the server.';
  if (message.includes('OpenAI OCR failed')) return 'OCR could not read this file. Please try a clearer PDF or image.';
  return 'Upload failed. Please try again.';
}

export default function NewDocumentScreen() {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>('pick');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [docType, setDocType] = useState<DocType>(DocType.LabReport);
  const [sourceDate, setSourceDate] = useState<Date | null>(null);
  const [draftSourceDate, setDraftSourceDate] = useState(new Date());
  const [labName, setLabName] = useState('');
  const [orderingPhysician, setOrderingPhysician] = useState('');
  const [notes, setNotes] = useState('');
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showSourceDatePicker, setShowSourceDatePicker] = useState(false);
  const [error, setError] = useState('');

  function formatSourceDate(date: Date): string {
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function openSourceDatePicker(): void {
    setDraftSourceDate(sourceDate ?? new Date());
    setShowSourceDatePicker(true);
  }

  async function pickFromCamera(): Promise<void> {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera access is needed to capture documents.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setFile({ uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg', size: asset.fileSize ?? 0 });
      setStep('form');
    }
  }

  async function pickFromGallery(): Promise<void> {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Photo library access is needed to pick documents.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setFile({ uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg', size: asset.fileSize ?? 0 });
      setStep('form');
    }
  }

  async function pickPdf(): Promise<void> {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setFile({ uri: asset.uri, mimeType: asset.mimeType ?? 'application/pdf', size: asset.size ?? 0 });
      setStep('form');
    }
  }

  async function submit(): Promise<void> {
    if (!file) return;
    setError('');
    if (!sourceDate) {
      setError('Please choose a source date.');
      return;
    }

    setStep('uploading');
    try {
      const { documentId, uploadUrl, fileKey } = await createDocument({
        docType,
        sourceDate: formatSourceDate(sourceDate),
        fileType: file.mimeType,
        fileSize: file.size || 1,
        labName: labName.trim() || undefined,
        orderingPhysician: orderingPhysician.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      await uploadToPresignedUrl(uploadUrl, file);
      await markUploaded(documentId, fileKey);
      await qc.invalidateQueries({ queryKey: ['documents'] });
      router.replace(`/documents/${documentId}`);
    } catch (err) {
      setError(uploadErrorMessage(err));
      setStep('form');
    }
  }

  if (step === 'uploading') {
    return (
      <CenteredScreen>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[typography.body, { marginTop: spacing.md }]}>Uploading and queuing OCR...</Text>
      </CenteredScreen>
    );
  }

  const docTypeLabel = DOC_TYPE_OPTIONS.find((o) => o.value === docType)?.label ?? docType;

  if (step === 'pick') {
    return (
      <AppScroll>
        <TopBar
          eyebrow="Upload"
          title="Add document"
          action={<Button label="Close" variant="secondary" onPress={() => router.back()} style={styles.closeButton} />}
        />
        <HeroCard tone="light">
          <Text style={typography.h3}>Choose source</Text>
          <Text style={[typography.body, { marginTop: spacing.xs }]}>
            Camera and photo permissions are requested only after selection.
          </Text>
        </HeroCard>
        <View style={styles.sourceRow}>
          <UploadSourceTile
            code="CAM"
            label="Camera"
            icon={<Feather name="camera" size={17} color="#FFFFFF" />}
            onPress={() => void pickFromCamera()}
          />
          <UploadSourceTile
            code="IMG"
            label="Gallery"
            icon={<Feather name="image" size={17} color="#FFFFFF" />}
            onPress={() => void pickFromGallery()}
          />
          <UploadSourceTile
            code="PDF"
            label="PDF"
            icon={<Feather name="file-text" size={17} color="#FFFFFF" />}
            onPress={() => void pickPdf()}
          />
        </View>
      </AppScroll>
    );
  }

  return (
    <AppScroll>
      <TopBar
        eyebrow="Upload"
        title="Add document"
        action={<Button label="Close" variant="secondary" onPress={() => router.back()} style={styles.closeButton} />}
      />
      <Card>
        <Text style={styles.label}>Document type</Text>
        <Pressable style={styles.selectBox} onPress={() => setShowTypeModal(true)}>
          <Text style={styles.selectText}>{docTypeLabel}</Text>
          <Text style={styles.selectText}>Change</Text>
        </Pressable>
      </Card>

      <View style={styles.dateGroup}>
        <Text style={styles.dateLabel}>Source date</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Select source date"
          onPress={openSourceDatePicker}
          style={styles.dateField}
        >
          <Text style={[styles.dateText, !sourceDate && styles.datePlaceholder]}>
            {sourceDate ? formatSourceDate(sourceDate) : 'Select date'}
          </Text>
          <Feather name="calendar" size={17} color={colors.textSecondary} />
        </Pressable>
      </View>
      <TextField label="Lab or hospital" value={labName} onChangeText={setLabName} placeholder="Optional" />
      <TextField
        label="Ordering doctor"
        value={orderingPhysician}
        onChangeText={setOrderingPhysician}
        placeholder="Optional"
      />
      <TextField label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional context" multiline />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button label="Upload document" onPress={() => void submit()} />
      <Button label="Back" variant="secondary" onPress={() => setStep('pick')} />

      <Modal
        visible={showSourceDatePicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSourceDatePicker(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.dateSheet}>
            <Text style={styles.sheetTitle}>Source date</Text>
            <DateTimePicker
              value={draftSourceDate}
              mode="date"
              display="spinner"
              style={styles.datePicker}
              maximumDate={new Date()}
              minimumDate={new Date(1900, 0, 1)}
              onChange={(_, selectedDate) => {
                if (selectedDate) setDraftSourceDate(selectedDate);
              }}
            />
            <View style={styles.sheetActions}>
              <Button
                label="Cancel"
                variant="secondary"
                onPress={() => setShowSourceDatePicker(false)}
                style={styles.sheetButton}
              />
              <Button
                label="Done"
                onPress={() => {
                  setSourceDate(draftSourceDate);
                  setShowSourceDatePicker(false);
                }}
                style={styles.sheetButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showTypeModal} animationType="slide" onRequestClose={() => setShowTypeModal(false)}>
        <AppScroll contentStyle={{ justifyContent: 'center', flexGrow: 1 }}>
          <Text style={typography.h2}>Document type</Text>
          <View style={{ marginTop: spacing.md }}>
            {DOC_TYPE_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                style={[styles.typeOption, docType === opt.value && styles.typeOptionActive]}
                onPress={() => {
                  setDocType(opt.value);
                  setShowTypeModal(false);
                }}
              >
                <Text style={[styles.typeOptionText, docType === opt.value && styles.typeOptionTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Button label="Cancel" variant="secondary" onPress={() => setShowTypeModal(false)} />
        </AppScroll>
      </Modal>
    </AppScroll>
  );
}

const styles = StyleSheet.create({
  closeButton: { minWidth: 84, minHeight: 38, marginTop: 0, paddingHorizontal: spacing.md },
  sourceRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: '800', marginBottom: spacing.xs },
  dateGroup: { marginBottom: spacing.md },
  dateLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '800', marginBottom: spacing.xs },
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
  selectBox: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  selectText: { color: colors.textPrimary, fontSize: 13, fontWeight: '800' },
  error: { color: colors.danger, marginBottom: spacing.sm },
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
  sheetTitle: { color: colors.textPrimary, fontSize: 16, lineHeight: 21, fontWeight: '800' },
  datePicker: { height: 216 },
  sheetActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  sheetButton: { flex: 1, marginTop: 0 },
  typeOption: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  typeOptionActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  typeOptionText: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  typeOptionTextActive: { color: '#FFFFFF' },
});
