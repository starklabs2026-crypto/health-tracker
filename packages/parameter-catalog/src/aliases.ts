import type { ParameterCatalogEntry } from '@medical-tracker/shared-types';

import { PARAMETER_SEED } from './seed.js';

/**
 * Flattened lookup from a normalized alias/canonical-name string to its catalog
 * entry. Keys are lowercased and whitespace-collapsed for case-insensitive
 * exact matching before falling back to the fuzzy matcher.
 */
export function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/\s+/g, ' ').trim();
}

function buildAliasIndex(entries: ParameterCatalogEntry[]): Map<string, ParameterCatalogEntry> {
  const index = new Map<string, ParameterCatalogEntry>();
  for (const entry of entries) {
    index.set(normalizeLabel(entry.canonicalName), entry);
    for (const alias of entry.aliases) {
      index.set(normalizeLabel(alias), entry);
    }
  }
  return index;
}

export const ALIAS_INDEX: Map<string, ParameterCatalogEntry> = buildAliasIndex(PARAMETER_SEED);

/** Exact (case-insensitive) match of a label against canonical names + aliases. */
export function findByExactLabel(label: string): ParameterCatalogEntry | undefined {
  return ALIAS_INDEX.get(normalizeLabel(label));
}

/** Lookup a catalog entry by its stable id. */
export const BY_ID: Map<string, ParameterCatalogEntry> = new Map(
  PARAMETER_SEED.map((e) => [e.id, e]),
);

export function findById(id: string): ParameterCatalogEntry | undefined {
  return BY_ID.get(id);
}
