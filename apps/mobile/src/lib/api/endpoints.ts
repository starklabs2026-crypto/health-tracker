import type {
  DevicePlatform,
  MeResponse,
  OtpRequestResponse,
  OtpVerifyResponse,
  UpdateHealthProfileRequest,
  UpdateMeRequest,
} from '@medical-tracker/shared-types';

import { api } from './client';

export async function requestOtp(identifier: string): Promise<OtpRequestResponse> {
  const { data } = await api.post<OtpRequestResponse>('/auth/otp/request', { identifier });
  return data;
}

export async function verifyOtp(input: {
  identifier: string;
  code: string;
  deviceId: string;
  platform: DevicePlatform;
}): Promise<OtpVerifyResponse> {
  const { data } = await api.post<OtpVerifyResponse>('/auth/otp/verify', input);
  return data;
}

export async function getMe(): Promise<MeResponse> {
  const { data } = await api.get<MeResponse>('/me');
  return data;
}

export async function updateMe(body: UpdateMeRequest): Promise<MeResponse> {
  const { data } = await api.put<MeResponse>('/me', body);
  return data;
}

export async function updateHealthProfile(body: UpdateHealthProfileRequest): Promise<MeResponse> {
  const { data } = await api.put<MeResponse>('/me/health-profile', body);
  return data;
}

export async function pairBiometric(): Promise<void> {
  await api.post('/auth/biometric/pair');
}
