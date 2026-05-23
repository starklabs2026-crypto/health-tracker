import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { HealthResponse, ServiceStatus } from '@medical-tracker/shared-types';
import Redis from 'ioredis';

import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async check(): Promise<HealthResponse> {
    const [db, redis] = await Promise.all([this.checkDb(), this.checkRedis()]);
    const status: HealthResponse['status'] = db === 'up' && redis === 'up' ? 'ok' : 'degraded';
    return { status, db, redis };
  }

  private async checkDb(): Promise<ServiceStatus> {
    return (await this.prisma.isHealthy()) ? 'up' : 'down';
  }

  private async checkRedis(): Promise<ServiceStatus> {
    const url = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    const client = new Redis(url, {
      lazyConnect: true,
      connectTimeout: 1500,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    try {
      await client.connect();
      const pong = await client.ping();
      return pong === 'PONG' ? 'up' : 'down';
    } catch {
      return 'down';
    } finally {
      client.disconnect();
    }
  }
}
