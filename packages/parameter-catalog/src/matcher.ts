import type { ParameterCatalogEntry } from '@medical-tracker/shared-types';
import Fuse from 'fuse.js';

import { findByExactLabel, normalizeLabel } from './aliases.js';
import { PARAMETER_SEED } from './seed.js';

export interface MatchResult {
  entry: ParameterCatalogEntry;
  /** 0..1 confidence (1 = exact). Worker maps this onto its confidence score. */
  score: number;
  exact: boolean;
}

/**
 * Fuzzy matcher used by the OCR normalizer (playbook §2.2.2 stage 2). Each
 * catalog entry is indexed by its canonical name + aliases. Fuse returns a
 * distance score (0 = perfect); we invert it to a 0..1 confidence and apply
 * the playbook's 0.3 distance threshold.
 */
const FUSE_THRESHOLD = 0.3;

interface SearchRow {
  label: string;
  entry: ParameterCatalogEntry;
}

const searchRows: SearchRow[] = PARAMETER_SEED.flatMap((entry) => [
  { label: entry.canonicalName, entry },
  ...entry.aliases.map((alias) => ({ label: alias, entry })),
]);

const fuse = new Fuse(searchRows, {
  keys: ['label'],
  includeScore: true,
  threshold: FUSE_THRESHOLD,
  ignoreLocation: true,
  getFn: (row) => normalizeLabel(row.label),
});

/**
 * Map an OCR-extracted label to a catalog entry. Tries an exact
 * (case-insensitive) match first, then fuzzy. Returns null if nothing clears
 * the threshold (caller should mark the candidate unmatched and skip).
 */
export function matchParameter(label: string): MatchResult | null {
  const exact = findByExactLabel(label);
  if (exact) return { entry: exact, score: 1, exact: true };

  const results = fuse.search(normalizeLabel(label));
  const best = results[0];
  if (!best || best.score === undefined) return null;
  if (best.score > FUSE_THRESHOLD) return null;

  return { entry: best.item.entry, score: 1 - best.score, exact: false };
}
