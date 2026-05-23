import { RangeFlag } from '@medical-tracker/shared-types';
import { describe, expect, it } from 'vitest';

import { findById } from './aliases.js';
import { matchParameter } from './matcher.js';
import { computeRangeFlag, formatRange } from './ranges.js';
import { PANELS, PARAMETER_SEED } from './seed.js';

describe('parameter catalog seed', () => {
  it('contains exactly 80 parameters across 12 panels', () => {
    expect(PARAMETER_SEED).toHaveLength(80);
    const panels = new Set(PARAMETER_SEED.map((p) => p.panel));
    expect(panels.size).toBe(12);
    expect(Object.keys(PANELS)).toHaveLength(12);
  });

  it('has unique ids and canonical names', () => {
    const ids = new Set(PARAMETER_SEED.map((p) => p.id));
    const names = new Set(PARAMETER_SEED.map((p) => p.canonicalName));
    expect(ids.size).toBe(80);
    expect(names.size).toBe(80);
  });
});

describe('computeRangeFlag', () => {
  const hemoglobin = findById('hemoglobin')!; // sex-variant
  const hba1c = findById('hba1c')!; // one-sided (< 5.7)
  const tsh = findById('tsh')!; // two-sided 0.4–4.0
  const weight = findById('body-weight')!; // no range

  it('applies sex-specific ranges (male)', () => {
    expect(computeRangeFlag(12.0, hemoglobin, { sex: 'male' })).toBe(RangeFlag.Low); // < 13.5
    expect(computeRangeFlag(15.0, hemoglobin, { sex: 'male' })).toBe(RangeFlag.Normal);
    expect(computeRangeFlag(18.0, hemoglobin, { sex: 'male' })).toBe(RangeFlag.High); // > 17.5
  });

  it('applies sex-specific ranges (female)', () => {
    expect(computeRangeFlag(12.5, hemoglobin, { sex: 'female' })).toBe(RangeFlag.Normal); // in 12.0–15.5
    expect(computeRangeFlag(11.0, hemoglobin, { sex: 'female' })).toBe(RangeFlag.Low);
  });

  it('handles one-sided upper bound (HbA1c < 5.7)', () => {
    expect(computeRangeFlag(5.2, hba1c)).toBe(RangeFlag.Normal);
    expect(computeRangeFlag(6.5, hba1c)).toBe(RangeFlag.High);
  });

  it('handles two-sided range (TSH 0.4–4.0)', () => {
    expect(computeRangeFlag(0.2, tsh)).toBe(RangeFlag.Low);
    expect(computeRangeFlag(2.0, tsh)).toBe(RangeFlag.Normal);
    expect(computeRangeFlag(5.0, tsh)).toBe(RangeFlag.High);
  });

  it('returns Unknown when no range is defined', () => {
    expect(computeRangeFlag(70, weight)).toBe(RangeFlag.Unknown);
  });
});

describe('formatRange', () => {
  it('formats two-sided, one-sided, and qualitative ranges', () => {
    expect(formatRange(findById('tsh')!)).toBe('0.4–4');
    expect(formatRange(findById('hba1c')!)).toBe('< 5.7');
    expect(formatRange(findById('hdl-cholesterol')!, { sex: 'male' })).toBe('> 40');
    expect(formatRange(findById('urine-glucose')!)).toBe('Negative');
  });
});

describe('matchParameter', () => {
  it('matches exact canonical names and aliases case-insensitively', () => {
    expect(matchParameter('Hemoglobin')?.entry.id).toBe('hemoglobin');
    expect(matchParameter('HGB')?.entry.id).toBe('hemoglobin');
    expect(matchParameter('hba1c')?.entry.id).toBe('hba1c');
  });

  it('fuzzy-matches near-miss OCR labels', () => {
    const m = matchParameter('Haemoglobin'); // British spelling / OCR drift
    expect(m?.entry.id).toBe('hemoglobin');
    expect(m?.exact).toBe(false);
  });

  it('returns null for unrelated labels', () => {
    expect(matchParameter('zzzzz unrelated label')).toBeNull();
  });
});
