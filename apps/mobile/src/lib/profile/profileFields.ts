const EPOCH_UTC = '1970-01-01T00:00:00.000Z';
const PLACEHOLDER_UTC = '2000-01-01T00:00:00.000Z';

/** True only for the instants account creation used when the person never entered a birthday. */
export function isPlaceholderDateOfBirth(value: string | null | undefined): boolean {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const utc = date.toISOString();
  return utc === EPOCH_UTC || utc === PLACEHOLDER_UTC;
}

export function displayedDateOfBirth(value: string | null | undefined): string | null {
  if (!value || isPlaceholderDateOfBirth(value)) return null;
  return value;
}

/** "Other" is a real choice. It is unset only when it was saved with a placeholder birthday. */
export function displayedSex(
  sex: string | null | undefined,
  dob: string | null | undefined,
): string | null {
  const trimmed = sex?.trim() ?? '';
  if (!trimmed || trimmed.toLowerCase() === 'not set') return null;
  if (trimmed.toLowerCase() === 'other' && isPlaceholderDateOfBirth(dob)) return null;
  return trimmed;
}
