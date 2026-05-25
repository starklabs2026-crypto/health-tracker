import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  type CreateReadingRequest,
  createReadingSchema,
  type PatchReadingRequest,
  patchReadingSchema,
  type Paginated,
  type ParameterReading,
  ReadingStatus,
  type TrendResponse,
} from '@medical-tracker/shared-types';

import { AuditLog } from '../common/audit-log.decorator.js';
import { CurrentUser, type AuthUser } from '../common/current-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ReadingsService } from './readings.service.js';

@Controller('readings')
export class ReadingsController {
  constructor(private readonly readings: ReadingsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('parameterId') parameterId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<Paginated<ParameterReading>> {
    return this.readings.list(user.id, {
      parameterId,
      dateFrom,
      dateTo,
      status: status as ReadingStatus | undefined,
      page: page !== undefined ? Number(page) : undefined,
      limit: limit !== undefined ? Number(limit) : undefined,
    });
  }

  @Post()
  @AuditLog('create', 'reading')
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createReadingSchema)) body: CreateReadingRequest,
  ): Promise<ParameterReading> {
    return this.readings.create(user.id, body);
  }

  // NOTE: 'trend' must be declared before ':id' so NestJS doesn't treat the
  // literal "trend" as an id parameter.
  @Get('trend')
  trend(
    @CurrentUser() user: AuthUser,
    @Query('parameterId') parameterId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<TrendResponse> {
    return this.readings.trend(user.id, parameterId, dateFrom, dateTo);
  }

  @Get(':id')
  getById(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<ParameterReading> {
    return this.readings.getById(user.id, id);
  }

  @Patch(':id')
  @AuditLog('update', 'reading')
  patch(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(patchReadingSchema)) body: PatchReadingRequest,
  ): Promise<ParameterReading> {
    return this.readings.patch(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @AuditLog('delete', 'reading')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    await this.readings.remove(user.id, id);
  }
}
