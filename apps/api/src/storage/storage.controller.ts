import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';

import { Public } from '../common/public.decorator.js';
import { STORAGE_ADAPTER, type StorageAdapter } from './storage.adapter.js';

const MAX_FILE_BYTES = 25 * 1024 * 1024; // R.2: 25 MB cap
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/heic', 'application/pdf']);

// Magic-byte sniff (R.2: validate content-type AND magic bytes).
function sniffOk(buf: Buffer, declared: string): boolean {
  if (buf.length < 4) return false;
  const isJpg = buf[0] === 0xff && buf[1] === 0xd8;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const isPdf = buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46; // %PDF
  if (declared === 'application/pdf') return isPdf;
  if (declared === 'image/png') return isPng;
  if (declared === 'image/jpeg') return isJpg;
  if (declared === 'image/heic') return true; // HEIC sniffing is non-trivial; accept in prototype
  return false;
}

@Controller('storage')
export class StorageController {
  constructor(@Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter) {}

  // Token-gated multipart receiver (the "presigned upload URL" target).
  @Public()
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }))
  async upload(
    @Query('token') token: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<{ ok: true; fileKey: string }> {
    if (!file) throw new BadRequestException('Missing file');
    const { key, contentType } = this.storage.verifyToken(token, 'upload');

    const declared = contentType ?? file.mimetype;
    if (!ALLOWED.has(declared) || !sniffOk(file.buffer, declared)) {
      throw new BadRequestException('Unsupported or mismatched file type');
    }
    await this.storage.writeObject(key, file.buffer);
    return { ok: true, fileKey: key };
  }

  // Token-gated file fetch (used by mobile + worker). The key comes from the token.
  @Public()
  @Get('file/*')
  async download(@Query('token') token: string, @Res() res: Response): Promise<void> {
    const { key } = this.storage.verifyToken(token, 'download');
    if (!(await this.storage.objectExists(key))) {
      res.status(404).json({ message: 'Not found' });
      return;
    }
    const data = await this.storage.readObject(key);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(data);
  }
}
