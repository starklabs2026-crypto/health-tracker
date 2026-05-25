import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';

import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import type {
  PresignedDownload,
  PresignedUpload,
  StorageAdapter,
} from './storage.adapter.js';

interface StorageTokenPayload {
  key: string;
  contentType?: string;
  op: 'upload' | 'download';
}

/**
 * Local-filesystem storage substitute. The "presigned URL" is a short-lived
 * signed JWT carrying the object key; the mobile client POSTs the file to
 * /storage/upload?token=... and fetches via /storage/file/:key?token=...
 */
@Injectable()
export class LocalStorageAdapter implements StorageAdapter {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  private get root(): string {
    return resolve(this.config.get<string>('STORAGE_LOCAL_PATH') ?? './storage');
  }

  private get apiBase(): string {
    // STORAGE_PUBLIC_BASE_URL lets physical devices (Expo Go) reach the upload
    // endpoint — set it to http://<machine-ip>:3000/storage in .env when testing
    // on a phone. We strip the path to get the API origin.
    const storagePublicBase = this.config.get<string>('STORAGE_PUBLIC_BASE_URL');
    if (storagePublicBase) {
      try {
        return new URL(storagePublicBase).origin;
      } catch { /* fall through */ }
    }
    const port = this.config.get<number>('API_PORT') ?? 3000;
    return `http://localhost:${port}`;
  }

  /** Resolve a key to an absolute path, refusing traversal outside the root. */
  private pathFor(key: string): string {
    const full = normalize(join(this.root, key));
    if (full !== this.root && !full.startsWith(this.root + sep)) {
      throw new BadRequestException('Invalid storage key');
    }
    return full;
  }

  getPresignedUploadUrl(key: string, contentType: string): PresignedUpload {
    const token = this.jwt.sign({ key, contentType, op: 'upload' } satisfies StorageTokenPayload, {
      expiresIn: '15m',
    });
    return {
      uploadUrl: `${this.apiBase}/storage/upload?token=${encodeURIComponent(token)}`,
      fileKey: key,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  }

  getPresignedDownloadUrl(key: string, ttlSec = 3600): PresignedDownload {
    const token = this.jwt.sign({ key, op: 'download' } satisfies StorageTokenPayload, {
      expiresIn: ttlSec,
    });
    return {
      downloadUrl: `${this.apiBase}/storage/file/${encodeURIComponent(key)}?token=${encodeURIComponent(token)}`,
      expiresAt: new Date(Date.now() + ttlSec * 1000).toISOString(),
    };
  }

  async writeObject(key: string, data: Buffer): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  async readObject(key: string): Promise<Buffer> {
    return readFile(this.pathFor(key));
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await stat(this.pathFor(key));
      return true;
    } catch {
      return false;
    }
  }

  async deleteObject(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  verifyToken(token: string, op: 'upload' | 'download'): { key: string; contentType?: string } {
    let payload: StorageTokenPayload;
    try {
      payload = this.jwt.verify<StorageTokenPayload>(token);
    } catch {
      throw new BadRequestException('Invalid or expired storage token');
    }
    if (payload.op !== op) throw new BadRequestException('Token not valid for this operation');
    return { key: payload.key, contentType: payload.contentType };
  }
}
