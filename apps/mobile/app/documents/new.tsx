import { Feather } from '@expo/vector-icons';
import { DocType } from '@medical-tracker/shared-types';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  AppScroll,
  Button,
  Card,
  EmptyState,
  IconButton,
  Pill,
  ProgressBar,
  SectionHeader,
  TopBar,
  UploadSourceTile,
} from '../../src/components/healthfolio';
import {
  type UploadQueueFile,
  type UploadQueueItem,
  type UploadQueueStatus,
  inferDocTypeForFile,
  useUploadQueueStore,
} from '../../src/lib/uploads/uploadQueueStore';
import { colors, spacing } from '../../src/theme/tokens';
import { useProfileStore } from '../../src/lib/profile/profileStore';

function fileNameFromUri(uri: string): string {
  const lastSegment = uri.split('/').pop() ?? 'report';
  return decodeURIComponent(lastSegment.split('?')[0] || 'report');
}

function normalizePickedFile(file: {
  uri: string;
  mimeType?: string | null;
  size?: number | null;
  name?: string | null;
}): UploadQueueFile {
  return {
    uri: file.uri,
    mimeType: file.mimeType ?? 'application/octet-stream',
    size: file.size ?? 0,
    name: file.name?.trim() || fileNameFromUri(file.uri),
  };
}

function queueTone(status: UploadQueueStatus): 'neutral' | 'blue' | 'green' | 'red' | 'active' {
  if (status === 'uploading' || status === 'processing') return 'blue';
  if (status === 'analyzed') return 'green';
  if (status === 'failed') return 'red';
  return 'neutral';
}

function queueLabel(status: UploadQueueStatus): string {
  if (status === 'uploading') return 'Uploading';
  if (status === 'processing') return 'Processing';
  if (status === 'analyzed') return 'Analyzed';
  if (status === 'failed') return 'Failed';
  return 'Queued';
}

function statusCopy(item: UploadQueueItem): string {
  if (item.status === 'failed') return item.error ?? 'This file needs another try.';
  if (item.status === 'analyzed') return 'Ready in Records.';
  if (item.status === 'processing') return 'Reading report.';
  if (item.status === 'uploading') return 'Uploading.';
  return 'Queued.';
}

function leadingIcon(item: UploadQueueItem): keyof typeof Feather.glyphMap {
  if (item.mimeType.includes('pdf')) return 'file-text';
  if (item.mimeType.startsWith('image/')) return 'image';
  return 'paperclip';
}

export default function NewDocumentScreen() {
  const { activeProfileId, activeProfileName } = useProfileStore();
  const items = useUploadQueueStore((state) => state.items);
  const addFiles = useUploadQueueStore((state) => state.addFiles);
  const retryItem = useUploadQueueStore((state) => state.retryItem);
  const removeItem = useUploadQueueStore((state) => state.removeItem);
  const clearFinished = useUploadQueueStore((state) => state.clearFinished);

  const queue = useMemo(() => {
    return [...items].sort((a, b) => b.createdAt - a.createdAt);
  }, [items]);

  const analyzedCount = queue.filter((item) => item.status === 'analyzed').length;

  function enqueueFiles(files: UploadQueueFile[]): void {
    if (files.length === 0) return;

    const hasPrescription = files.some(
      (file) => inferDocTypeForFile(file.name, file.mimeType) === DocType.Prescription,
    );

    const enqueue = () =>
      addFiles(files, {
        profileId: activeProfileId,
        profileName: activeProfileName,
      });

    if (!hasPrescription) {
      enqueue();
      return;
    }

    Alert.alert(
      'Verify prescription OCR',
      'Handwritten prescriptions can be misread. HealthFolio will organize the file, but you must review and approve extracted text before relying on it.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: enqueue },
      ],
    );
  }

  async function pickFromCamera(): Promise<void> {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]) {
      enqueueFiles([normalizePickedFile(result.assets[0])]);
    }
  }

  async function pickFromGallery(): Promise<void> {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsMultipleSelection: true,
      selectionLimit: 0,
    });

    if (!result.canceled && result.assets.length > 0) {
      enqueueFiles(result.assets.map(normalizePickedFile));
    }
  }

  async function pickFiles(): Promise<void> {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
      multiple: true,
    });

    if (!result.canceled && result.assets.length > 0) {
      enqueueFiles(
        result.assets.map((asset) =>
          normalizePickedFile({
            uri: asset.uri,
            mimeType: asset.mimeType,
            size: asset.size,
            name: asset.name,
          }),
        ),
      );
    }
  }

  return (
    <AppScroll>
      <TopBar
        title="Add"
        action={
          <IconButton
            icon="x"
            label="Close"
            variant="secondary"
            onPress={() => router.replace('/(tabs)/documents')}
            style={styles.closeButton}
          />
        }
      />

      <Card style={styles.sourceCard}>
        <View style={styles.sourceHeader}>
          <SectionHeader icon="upload-cloud" title="Source" style={styles.cardHeader} />
          <Pill label="OCR" tone="blue" />
        </View>
        <View style={styles.sourceRow}>
          <UploadSourceTile
            code="CAM"
            label="Camera"
            icon={<Feather name="camera" size={17} color="#FFFFFF" />}
            onPress={() => void pickFromCamera()}
          />
          <UploadSourceTile
            code="IMG"
            label="Photos"
            icon={<Feather name="image" size={17} color="#FFFFFF" />}
            onPress={() => void pickFromGallery()}
          />
          <UploadSourceTile
            code="FILE"
            label="Files"
            icon={<Feather name="file-text" size={17} color="#FFFFFF" />}
            onPress={() => void pickFiles()}
          />
        </View>
      </Card>

      <Card>
        <View style={styles.queueHeader}>
          <View>
            <SectionHeader icon="activity" title="Queue" style={styles.cardHeader} />
          </View>
          {analyzedCount > 0 ? (
            <Button
              label="Clear"
              variant="secondary"
              onPress={clearFinished}
              style={styles.headerButton}
            />
          ) : null}
        </View>

        {queue.length === 0 ? (
          <EmptyState icon="upload-cloud" title="No files" body="Add a report." />
        ) : (
          <View style={styles.queueList}>
            {queue.map((item) => (
              <View key={item.localId} style={styles.queueItem}>
                <View style={styles.queueTop}>
                  <View style={styles.queueLead}>
                    <View style={styles.fileIcon}>
                      <Feather name={leadingIcon(item)} size={18} color={colors.primary} />
                    </View>
                    <View style={styles.queueText}>
                      <Text numberOfLines={1} style={styles.fileName}>
                        {item.name}
                      </Text>
                      <Text numberOfLines={2} style={styles.fileCopy}>
                        {statusCopy(item)}
                      </Text>
                    </View>
                  </View>
                  <Pill label={queueLabel(item.status)} tone={queueTone(item.status)} />
                </View>

                <ProgressBar value={item.progress} />

                <View style={styles.queueMeta}>
                  <Text style={styles.queuePercent}>{Math.round(item.progress * 100)}%</Text>
                  {item.profileName ? (
                    <Text style={styles.queueProfile}>{item.profileName}</Text>
                  ) : null}
                </View>

                {item.status === 'failed' || item.status === 'analyzed' ? (
                  <View style={styles.queueActions}>
                    {item.status === 'failed' ? (
                      <Pressable onPress={() => retryItem(item.localId)}>
                        <Text style={styles.queueActionText}>Retry</Text>
                      </Pressable>
                    ) : item.documentId ? (
                      <Pressable onPress={() => router.push(`/documents/${item.documentId}`)}>
                        <Text style={styles.queueActionText}>Open</Text>
                      </Pressable>
                    ) : null}
                    <Pressable onPress={() => removeItem(item.localId)}>
                      <Text style={styles.queueRemoveText}>Remove</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </Card>
    </AppScroll>
  );
}

const styles = StyleSheet.create({
  closeButton: { width: 42, height: 42, borderRadius: 21 },
  sourceCard: {
    padding: spacing.lg,
    backgroundColor: colors.primaryBg,
  },
  sourceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardHeader: { marginTop: 0, marginBottom: 0 },
  sourceRow: { gap: spacing.sm, marginTop: spacing.md },
  queueHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerButton: { minHeight: 34, marginTop: 0, paddingHorizontal: spacing.sm },
  queueList: { marginTop: spacing.md, gap: spacing.md },
  queueItem: { gap: spacing.sm },
  queueTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  queueLead: { flexDirection: 'row', flex: 1, gap: spacing.sm },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softSurface,
  },
  queueText: { flex: 1, gap: 2 },
  fileName: { color: colors.textPrimary, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  fileCopy: { color: colors.textSecondary, fontSize: 12, lineHeight: 17 },
  queueMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  queuePercent: { color: colors.textSecondary, fontSize: 11, lineHeight: 15, fontWeight: '700' },
  queueProfile: { color: colors.textSecondary, fontSize: 11, lineHeight: 15 },
  queueActions: { flexDirection: 'row', gap: spacing.md },
  queueActionText: { color: colors.primary, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  queueRemoveText: { color: colors.textSecondary, fontSize: 12, lineHeight: 16, fontWeight: '700' },
});
