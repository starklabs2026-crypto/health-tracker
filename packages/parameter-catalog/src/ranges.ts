import { type NumericRange, type ParameterCatalogEntry, RangeFlag } from '@medical-tracker/shared-types';

export interface RangeContext {
  /** Age in years; used only for age-banded parameters (sparse in the seed). */
  ageYears?: number;
  /** 'male' | 'female' selects sex-specific ranges when defined. */
  sex?: 'male' | 'female';
}

/** Resolve the applicable numeric range for a parameter given age/sex. */
export function resolveRange(
  parameter: ParameterCatalogEntry,
  ctx: RangeContext = {},
): NumericRange | null {
  const def = parameter.rangeDefault;

  if (ctx.sex && def.bySex && def.bySex[ctx.sex]) {
    return def.bySex[ctx.sex] ?? null;
  }
  if (ctx.ageYears !== undefined && def.byAge) {
    const age = ctx.ageYears;
    const band = def.byAge.find((b) => age >= b.minAge && age <= b.maxAge);
    if (band) return band.range;
  }
  return def.default;
}

/**
 * Classify a numeric value into Low / Normal / High / Critical / Unknown.
 * Critical thresholds (when present) take precedence over the normal range.
 * Returns Unknown when no usable numeric range is defined for the parameter.
 */
export function computeRangeFlag(
  value: number,
  parameter: ParameterCatalogEntry,
  ctx: RangeContext = {},
): RangeFlag {
  if (parameter.criticalLow !== null && value < parameter.criticalLow) return RangeFlag.Critical;
  if (parameter.criticalHigh !== null && value > parameter.criticalHigh) return RangeFlag.Critical;

  const range = resolveRange(parameter, ctx);
  if (!range || (range.min === null && range.max === null)) return RangeFlag.Unknown;

  if (range.min !== null && value < range.min) return RangeFlag.Low;
  if (range.max !== null && value > range.max) return RangeFlag.High;
  return RangeFlag.Normal;
}

/** Human-readable range label, e.g. "13.5–17.5", "< 200", "> 40", "—". */
export function formatRange(parameter: ParameterCatalogEntry, ctx: RangeContext = {}): string {
  if (parameter.rangeDefault.qualitativeNormal) return parameter.rangeDefault.qualitativeNormal;
  const range = resolveRange(parameter, ctx);
  if (!range) return '—';
  const { min, max } = range;
  if (min !== null && max !== null) return `${min}–${max}`;
  if (min !== null) return `> ${min}`;
  if (max !== null) return `< ${max}`;
  return '—';
}
