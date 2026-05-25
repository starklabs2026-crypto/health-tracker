/**
 * Storage adapter interface. Mirrors the shape of an S3/GCS presigned-URL flow
 * so swapping LocalStorageAdapter -> S3Adapter later is mechanical (R.4 / playbook
 * substitution map). Business logic depends on this interface, never on FS calls.
 */
export interface PresignedUpload {
  uploadUrl: string;
  fileKey: string;
  expiresAt: string;
}

export interface PresignedDownload {
  downloadUrl: string;
  expiresAt: string;
}

export interface StorageAdapter {
  getPresignedUploadUrl(key: string, contentType: string): PresignedUpload;
  getPresignedDownloadUrl(key: string, ttlSec?: number): PresignedDownload;
  writeObject(key: string, data: Buffer): Promise<void>;
  readObject(key: string): Promise<Buffer>;
  objectExists(key: string): Promise<boolean>;
  deleteObject(key: string): Promise<void>;
  /** Verify a signed upload/download token; returns the key it authorizes. */
  verifyToken(token: string, op: 'upload' | 'download'): { key: string; contentType?: string };
}

export const STORAGE_ADAPTER = Symbol('STORAGE_ADAPTER');
