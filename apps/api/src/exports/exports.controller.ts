import {
  Controller,
  Get,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import { CurrentUser, type AuthUser } from '../common/current-user.decorator.js';
import { ExportsService } from './exports.service.js';

@Controller('exports')
export class ExportsController {
  constructor(private readonly exports: ExportsService) {}

  /**
   * GET /exports/pdf?profileId=<userId>
   * Streams a health summary PDF for the caller (or a shared profile they can access).
   */
  @Get('pdf')
  async pdf(
    @CurrentUser() user: AuthUser,
    @Query('profileId') profileId: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const targetId = profileId ?? user.id;
    const filename = `health-summary-${new Date().toISOString().split('T')[0]}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await this.exports.streamPdf(user.id, targetId, res);
  }
}
