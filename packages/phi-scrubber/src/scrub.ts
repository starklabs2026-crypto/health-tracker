/**
 * PHI scrubber. Recursively walks a value and redacts any property whose KEY
 * looks like it could carry Protected Health Information / PII.
 *
 * This is intentionally a denylist of key NAMES (not values): logging code
 * should never emit these fields. Production code must log through the logger
 * in `logger.ts`, never `console.*` directly (enforced by scripts/phi-scan.mjs).
 */

export const REDACTED = '[REDACTED]';

/** Keys matching this pattern have their values replaced with [REDACTED]. */
export const PHI_KEY_PATTERN = /name|email|phone|dob|address|value|parameter/i;

/** Scrubbing can be disabled in tests via PHI_SCRUB_OFF=1 for assertions. */
function scrubbingDisabled(): boolean {
  return process.env.PHI_SCRUB_OFF === '1';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function scrubValue(value: unknown, seen: WeakSet<object>): unknown {
  if (Array.isArray(value)) {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    return value.map((item) => scrubValue(item, seen));
  }
  if (isPlainObject(value)) {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = PHI_KEY_PATTERN.test(key) ? REDACTED : scrubValue(val, seen);
    }
    return out;
  }
  // Primitives and unsupported types pass through unchanged.
  return value;
}

/**
 * Recursively redact PHI-shaped keys from an arbitrary object/array.
 * Returns a new, scrubbed copy; the input is not mutated.
 */
export function scrub<T>(obj: T): T {
  if (scrubbingDisabled()) return obj;
  return scrubValue(obj, new WeakSet<object>()) as T;
}
