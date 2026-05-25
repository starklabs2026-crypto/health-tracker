import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { LocalStorageAdapter } from './local-storage.adapter.js';
import { StorageController } from './storage.controller.js';
import { STORAGE_ADAPTER } from './storage.adapter.js';

@Module({
  imports: [
    // Module-local JWT for short-lived storage tokens (separate signing config).
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'dev-insecure-secret',
      }),
    }),
  ],
  controllers: [StorageController],
  providers: [LocalStorageAdapter, { provide: STORAGE_ADAPTER, useExisting: LocalStorageAdapter }],
  exports: [STORAGE_ADAPTER],
})
export class StorageModule {}
