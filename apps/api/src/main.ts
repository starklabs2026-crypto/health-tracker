import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { logger } from '@medical-tracker/phi-scrubber';
import helmet from 'helmet';

import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });

  app.use(helmet());
  app.enableCors({
    // Dev: allow any localhost origin (mobile/web run on various ports).
    origin: /^http:\/\/localhost(:\d+)?$/,
    credentials: true,
  });

  const port = Number(process.env.API_PORT ?? 3000);
  const host = process.env.API_HOST ?? '0.0.0.0';
  await app.listen(port, host);
  logger.info('API listening', { port, host });
}

void bootstrap();
