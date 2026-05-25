import { DocType } from '@medical-tracker/shared-types';
import { useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
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
  createDocument,
  markUploaded,
  uploadToPresignedUrl,
} from '../../src/lib/api/endpoints';
import { colors, radius, spacing, tapTarget } from '../../src/theme/tokens';

type Step = 'pick' | 'form' | 'uploading';

interface PickedFile {
  uri: string;
  mimeType: string;
  size: number;
}

const DOC_TYPE_OPTIONS: { label: string; value: DocType }[] = [
  { label: 'Lab Report', value: DocType.LabReport },
  { label: 'Prescription', value: DocType.Prescription },
  { label: 'Imaging Report', value: DocType.ImagingReport },
  { label: 'Discharge Summary', value: DocType.DischargeSummary },
  { label: 'Vaccination Record', value: DocType.VaccinationRecord },
  { label: 'Other', value: DocType.Other },
];

export default function NewDocumentScreen() {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>('pick');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [docType, setDocType] = useState<DocType>(DocType.LabReport);
  const [sourceDate, setSourceDate] = useState(new Date().toISOString().split('T')[0] ?? '');
  const [labName, setLabName] = useState('');
  const [orderingPhysician, setOrderingPhysician] = useState('');
  const [notes, setNotes] = useState('');
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [error, setError] = useState('');

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
      setFile({
        uri: asset.uri,
        mimeType: asset.mimeType ?? 'image/jpeg',
        size: asset.fileSize ?? 0,
      });
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
      setFile({
        uri: asset.uri,
        mimeType: asset.mimeType ?? 'image/jpeg',
        size: asset.fileSize ?? 0,
      });
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
      setFile({
        uri: asset.uri,
        mimeType: asset.mimeType ?? 'application/pdf',
        size: asset.size ?? 0,
      });
      setStep('form');
    }
  }

  async function submit(): Promise<void> {
    if (!file) return;
    setError('');

    if (!sourceDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      setError('Date must be YYYY-MM-DD');
      return;
    }

    setStep('uploading');
    try {
      const { documentId, uploadUrl, fileKey } = await createDocument({
        docType,
        sourceDate,
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
      setError('Upload failed. Please check your connection and try again.');
      setStep('form');
    }
  }

  if (step === 'pick') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Add Document</Text>
        <Text style={styles.subtitle}>Choose a source for your document.</Text>
        <PickOption label="Camera" description="Capture a photo right now" onPress={() => void pickFromCamera()} />
        <PickOption label="Gallery" description="Pick an image from your photos" onPress={() => void pickFromGallery()} />
        <PickOption label="PDF File" description="Select a PDF from your files" onPress={() => void pickPdf()} />
        <Button label="Cancel" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  if (step === 'uploading') {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.uploadingText}>Uploading and queuing OCR…</Text>
      </View>
    );
  }

  const docTypeLabel = DOC_TYPE_OPTIONS.find((o) => o.value === docType)?.label ?? docType;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Document Details</Text>

      <Text style={styles.label}>Document Type</Text>
      <Pressable style={styles.selectBox} onPress={() => setShowTypeModal(true)}>
        <Text style={styles.selectBoxText}>{docTypeLabel}</Text>
        <Text style={styles.selectCaret}>›</Text>
      </Pressable>

      <TextField
        label="Date on document (YYYY-MM-DD)"
        value={sourceDate}
        onChangeText={setSourceDate}
        placeholder="2024-01-15"
        keyboardType="numeric"
      />
      <TextField
        label="Lab / Hospital name (optional)"
        value={labName}
        onChangeText={setLabName}
        placeholder="e.g. Apollo Diagnostics"
      />
      <TextField
        label="Ordering physician (optional)"
        value={orderingPhysician}
        onChangeText={setOrderingPhysician}
        placeholder="e.g. Dr. Smith"
      />
      <TextField
        label="Notes (optional)"
        value={notes}
        onChangeText={setNotes}
        placeholder="Any additional context"
        multiline
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button label="Upload & OCR" onPress={() => void submit()} />
      <Button label="Back" variant="secondary" onPress={() => setStep('pick')} />

      <Modal visible={showTypeModal} animationType="slide" onRequestClose={() => setShowTypeModal(false)}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Document Type</Text>
          {DOC_TYPE_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              style={[styles.typeOption, docType === opt.value ? styles.typeOptionActive : null]}
              onPress={() => { setDocType(opt.value); setShowTypeModal(false); }}
            >
              <Text style={[styles.typeOptionText, docType === opt.value ? styles.typeOptionTextActive : null]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
          <Button label="Cancel" variant="secondary" onPress={() => setShowTypeModal(false)} />
        </View>
      </Modal>
    </ScrollView>
  );
}

function PickOption({ label, description, onPress }: { label: string; description: string; onPress: () => void }) {
  return (
    <Pressable style={styles.pickOption} onPress={onPress} accessibilityRole="button">
      <Text style={styles.pickOptionLabel}>{label}</Text>
      <Text style={styles.pickOptionDesc}>{description}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: colors.primary, marginBottom: spacing.xs },
  subtitle: { fontSize: 15, color: colors.textSecondary, marginBottom: spacing.xl },
  label: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.xs },
  error: { color: colors.danger, fontSize: 14, marginBottom: spacing.sm },
  uploadingText: { marginTop: spacing.lg, fontSize: 16, color: colors.textSecondary },
  pickOption: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    minHeight: tapTarget,
    justifyContent: 'center',
  },
  pickOptionLabel: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  pickOptionDesc: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs },
  selectBox: {
    minHeight: tapTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
  },
  selectBoxText: { fontSize: 16, color: colors.textPrimary },
  selectCaret: { fontSize: 20, color: colors.textSecondary },
  modal: { flex: 1, padding: spacing.xl, backgroundColor: colors.background, justifyContent: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.primary, marginBottom: spacing.lg },
  typeOption: {
    minHeight: tapTarget,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  typeOptionActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  typeOptionText: { fontSize: 16, color: colors.textPrimary },
  typeOptionTextActive: { color: '#FFFFFF', fontWeight: '600' },
});
