import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { logger } from '@medical-tracker/phi-scrubber';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma client wrapper. Deliberately tolerant of an unavailable database at
 * boot: in the local prototype the developer may start the API before Docker
 * is up. We attempt to connect but never crash the process — the /health
 * endpoint reports db: 'down' instead. The same generated client is shared
 * with the worker (both import from @prisma/client).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      logger.info('Prisma connected to database');
    } catch (error) {
      logger.error('Prisma could not connect at startup (is Docker/Postgres up?)', error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Lightweight liveness probe used by the health check. */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
