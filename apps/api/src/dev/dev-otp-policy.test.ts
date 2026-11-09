import { describe, expect, it } from 'vitest';

import { isDevOtpEnabled } from './dev-otp-policy.js';

describe('dev OTP gate', () => {
  it('stays off in production even if another flag is set', () => {
    expect(isDevOtpEnabled({ NODE_ENV: 'production', ENABLE_DEV_OTP: 'true' })).toBe(false);
    expect(isDevOtpEnabled({})).toBe(false);
    expect(isDevOtpEnabled({ NODE_ENV: 'development' })).toBe(true);
    expect(isDevOtpEnabled({ NODE_ENV: 'test' })).toBe(true);
  });
});
