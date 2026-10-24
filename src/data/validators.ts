/**
 * Runtime validators for snapshot JSON. Pure functions; throw on malformed data.
 * Only species with a non-empty source are usable (species.json rule).
 * Full schema checks are added in a later task.
 */
import type { SpeciesEntry, SpeciesFile } from './types';

/** A species is usable only if it has a cited, verified, numeric threshold. */
export function isUsableSpecies(entry: SpeciesEntry): boolean {
  return (
    entry.verified &&
    entry.source.trim().length > 0 &&
    typeof entry.thresholdC === 'number' &&
    Number.isFinite(entry.thresholdC)
  );
}

/** Return only the species entries safe to show and score. */
export function usableSpecies(file: SpeciesFile): SpeciesEntry[] {
  return file.species.filter(isUsableSpecies);
}
