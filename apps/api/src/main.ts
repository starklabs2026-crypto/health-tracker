import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { logger } from '@medical-tracker/phi-scrubber';
import helmet from 'helmet';

import { AppModule } from './app.module.js';

function corsOrigins(): (string | RegExp)[] {
  const configured = process.env.CORS_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configured?.length) return configured;

  return [/^http:\/\/localhost(:\d+)?$/, /^https:\/\/localhost(:\d+)?$/];
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });

  app.use(helmet());
  app.enableCors({
    origin: corsOrigins(),
    credentials: true,
  });

  const port = Number(process.env.API_PORT ?? 3000);
  const host = process.env.API_HOST ?? '0.0.0.0';
  await app.listen(port, host);
  logger.info('API listening', { port, host });
}

void bootstrap();
