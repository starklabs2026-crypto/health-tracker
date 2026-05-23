import { z } from 'zod';

/** Platform a device runs on (for the Device registry). */
export enum DevicePlatform {
  iOS = 'ios',
  Android = 'android',
  Web = 'web',
}

export const devicePlatformSchema = z.nativeEnum(DevicePlatform);

/**
 * An identifier is either an email or an E.164-ish phone number.
 * Kept permissive at the type boundary; per-endpoint schemas tighten this.
 */
export const identifierSchema = z
  .string()
  .min(3)
  .refine(
    (v) => v.includes('@') || /^\+?[0-9]{6,15}$/.test(v),
    'Must be a valid email or phone number',
  );

export const otpRequestSchema = z.object({
  identifier: identifierSchema,
});
export type OtpRequest = z.infer<typeof otpRequestSchema>;

export const otpVerifySchema = z.object({
  identifier: identifierSchema,
  code: z.string().length(6),
  deviceId: z.string().min(1),
  platform: devicePlatformSchema,
});
export type OtpVerify = z.infer<typeof otpVerifySchema>;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
