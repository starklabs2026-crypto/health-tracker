import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/**
 * Validates a request payload against a Zod schema (R.1: Zod on every API
 * boundary; schemas live in @medical-tracker/shared-types). Used per-handler:
 *
 *   @Body(new ZodValidationPipe(otpRequestSchema)) body: OtpRequest
 *
 * On failure it throws a generic BadRequest WITHOUT echoing the offending
 * value — never leak PHI in validation errors (R.2). Field paths only.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path.join('.')).filter(Boolean);
      throw new BadRequestException({
        message: 'Invalid request',
        fields: fields.length > 0 ? fields : undefined,
      });
    }
    return result.data;
  }
}
