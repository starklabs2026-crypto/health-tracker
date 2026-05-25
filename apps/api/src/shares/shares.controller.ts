import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import {
  type CreateShareRequest,
  createShareSchema,
  type CreateShareResponse,
  type DoctorShare,
  type PublicShareView,
} from '@medical-tracker/shared-types';

import { CurrentUser, type AuthUser } from '../common/current-user.decorator.js';
import { Public } from '../common/public.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { SharesService } from './shares.service.js';

@Controller('shares')
export class SharesController {
  constructor(
    private readonly shares: SharesService,
    private readonly config: ConfigService,
  ) {}

  /** POST /shares — create a new share link */
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createShareSchema)) body: CreateShareRequest,
  ): Promise<CreateShareResponse> {
    const baseUrl = this.config.get<string>('DOCTOR_SHARE_URL') ?? 'http://localhost:3002';
    return this.shares.create(user.id, body, baseUrl);
  }

  /** GET /shares — list caller's active share links */
  @Get()
  list(@CurrentUser() user: AuthUser): Promise<DoctorShare[]> {
    return this.shares.list(user.id);
  }

  /** DELETE /shares/:id — revoke a share link */
  @Delete(':id')
  @HttpCode(204)
  revoke(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.shares.revoke(user.id, id);
  }
}

/** Unauthenticated — resolves the public token and returns the PHI-scoped view. */
@Public()
@Controller('public/share')
export class PublicShareController {
  constructor(private readonly shares: SharesService) {}

  @Get(':token')
  resolve(
    @Param('token') token: string,
    @Req() req: Request,
  ): Promise<PublicShareView> {
    const ua = req.headers['user-agent'] ?? null;
    return this.shares.resolvePublic(token, ua);
  }
}
