import { beforeEach, describe, expect, it } from 'vitest';

import { REDACTED, scrub } from './scrub.js';

describe('scrub', () => {
  beforeEach(() => {
    // Ensure scrubbing is ON regardless of ambient env during the test run.
    delete process.env.PHI_SCRUB_OFF;
  });

  it('redacts top-level PHI-shaped keys', () => {
    const out = scrub({ name: 'Alice', email: 'a@test.local', phone: '+15550001', age: 38 });
    expect(out.name).toBe(REDACTED);
    expect(out.email).toBe(REDACTED);
    expect(out.phone).toBe(REDACTED);
    expect(out.age).toBe(38);
  });

  it('redacts nested PHI keys including value/parameter/dob/address', () => {
    const out = scrub({
      reading: { parameter: 'Hemoglobin', value: 13.2, unit: 'g/dL' },
      profile: { dob: '1988-01-01', address: '1 Main St', residencyRegion: 'EU' },
    });
    expect(out.reading.parameter).toBe(REDACTED);
    expect(out.reading.value).toBe(REDACTED);
    expect(out.reading.unit).toBe('g/dL');
    expect(out.profile.dob).toBe(REDACTED);
    expect(out.profile.address).toBe(REDACTED);
    expect(out.profile.residencyRegion).toBe('EU');
  });

  it('walks arrays of objects', () => {
    const out = scrub({ readings: [{ value: 1 }, { value: 2 }] });
    expect(out.readings[0]?.value).toBe(REDACTED);
    expect(out.readings[1]?.value).toBe(REDACTED);
  });

  it('does not mutate the input', () => {
    const input = { name: 'Bob' };
    scrub(input);
    expect(input.name).toBe('Bob');
  });

  it('handles circular references without throwing', () => {
    const a: Record<string, unknown> = { id: 1 };
    a.self = a;
    expect(() => scrub(a)).not.toThrow();
  });

  it('is a no-op when PHI_SCRUB_OFF=1', () => {
    process.env.PHI_SCRUB_OFF = '1';
    const out = scrub({ name: 'Alice' });
    expect(out.name).toBe('Alice');
    delete process.env.PHI_SCRUB_OFF;
  });
});
