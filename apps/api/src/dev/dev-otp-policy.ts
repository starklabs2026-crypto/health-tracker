/** Dev OTP exists only for an explicit local/test runtime. Production cannot turn it on. */
export function isDevOtpEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'development' || env.NODE_ENV === 'test';
}
