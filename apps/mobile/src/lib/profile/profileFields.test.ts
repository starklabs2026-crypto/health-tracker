import { describe, expect, it } from 'vitest';

import { displayedDateOfBirth, displayedSex, isPlaceholderDateOfBirth } from './profileFields';

describe('new account profile fields', () => {
  it('treats the creation placeholders as unset', () => {
    expect(isPlaceholderDateOfBirth('2000-01-01T00:00:00.000Z')).toBe(true);
    expect(isPlaceholderDateOfBirth('1970-01-01T00:00:00.000Z')).toBe(true);
    expect(displayedDateOfBirth('2000-01-01T00:00:00.000Z')).toBeNull();
    expect(displayedSex('other', '2000-01-01T00:00:00.000Z')).toBeNull();
  });

  it('keeps a real birthday and an explicit Other sex', () => {
    expect(displayedDateOfBirth('1998-05-14T00:00:00.000Z')).toBe('1998-05-14T00:00:00.000Z');
    expect(displayedSex('other', '1998-05-14T00:00:00.000Z')).toBe('other');
    expect(displayedSex('female', null)).toBe('female');
  });
});
