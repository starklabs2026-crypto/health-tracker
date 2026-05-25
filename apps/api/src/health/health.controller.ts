import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@medical-tracker/shared-types';

import { Public } from '../common/public.decorator.js';
import { HealthService } from './health.service.js';

@Controller()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  // GET /health -> { status, db, redis } (playbook §0.1.6.5)
  @Public()
  @Get('health')
  check(): Promise<HealthResponse> {
    return this.health.check();
  }
}
