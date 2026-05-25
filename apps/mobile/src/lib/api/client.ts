import type { AuthTokens } from '@medical-tracker/shared-types';
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { router } from 'expo-router';

import { clearTokens, getTokens, setTokens } from '../auth/tokenStorage';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export const api = axios.create({ baseURL: API_URL, timeout: 10_000 });

// Bare client for refresh calls — must NOT pass through the interceptors below.
const bare = axios.create({ baseURL: API_URL, timeout: 10_000 });

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

// Attach the Bearer access token to every request.
api.interceptors.request.use(async (config) => {
  const tokens = await getTokens();
  if (tokens) {
    config.headers.Authorization = `Bearer ${tokens.accessToken}`;
  }
  return config;
});

// On 401, try a single refresh, then replay the request. On failure, log out.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    if (error.response?.status !== 401 || !original || original._retry) {
      return Promise.reject(error);
    }
    original._retry = true;

    const tokens = await getTokens();
    if (!tokens) {
      await forceLogout();
      return Promise.reject(error);
    }

    try {
      const { data } = await bare.post<AuthTokens>('/auth/refresh', {
        refreshToken: tokens.refreshToken,
      });
      await setTokens(data);
      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(original);
    } catch (refreshError) {
      await forceLogout();
      return Promise.reject(refreshError);
    }
  },
);

async function forceLogout(): Promise<void> {
  await clearTokens();
  router.replace('/welcome');
}
