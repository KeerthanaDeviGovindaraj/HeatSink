/**
 * Pure helpers for the SpeciesPicker display rule (R5.2, R5.3) and for adapting
 * committed {@link SpeciesEntry} data to the model {@link Species} shape.
 *
 * DISPLAY vs USABLE — the important nuance:
 *   `isUsableSpecies` (src/data/validators.ts) gates SCORING: it requires
 *   `verified === true` AND a source AND a numeric threshold. The DISPLAY rule
 *   for the picker is different (R5.2/R5.3): show a species when it has a
 *   NON-EMPTY SOURCE and a numeric thresholdC, and show an "unverified" badge
 *   when `verified === false`. Both committed species are currently
 *   verified:false with real sources + thresholds, so they MUST appear in the
 *   picker with the badge. Using `isUsableSpecies` here would hide every
 *   unverified species and violate R5.3, so the picker uses this display
 *   predicate instead.
 */
import type { SpeciesEntry } from '../data/types';
import type { Species } from '../model/types';

/**
 * True when a species entry may be DISPLAYED in the picker (R5.2, R5.3):
 * it has a non-empty source (R5.2 hides sourceless entries) and a finite
 * numeric threshold. Verification state does NOT gate display — an unverified
 * species is shown with a badge (R5.3), it is not hidden.
 *
 * @param entry A species entry from species.json.
 * @returns Whether the picker should list this species.
 */
export function isDisplayableSpecies(entry: SpeciesEntry): boolean {
  return (
    entry.source.trim().length > 0 &&
    typeof entry.thresholdC === 'number' &&
    Number.isFinite(entry.thresholdC)
  );
}

/** Return only the species entries the picker should display (R5.2, R5.3). */
export function displayableSpecies(entries: SpeciesEntry[]): SpeciesEntry[] {
  return entries.filter(isDisplayableSpecies);
}

/**
 * Adapt a DISPLAYABLE {@link SpeciesEntry} to the model {@link Species} shape
 * (thresholdC narrowed from `number | null` to `number`).
 *
 * Precondition: `entry` passes {@link isDisplayableSpecies}, so `thresholdC` is
 * a finite number. Throws if called on a non-displayable entry rather than
 * silently coercing a null threshold to 0.
 *
 * @param entry A displayable species entry.
 * @returns The model Species the scoring pipeline consumes.
 */
export function toModelSpecies(entry: SpeciesEntry): Species {
  if (entry.thresholdC === null || !Number.isFinite(entry.thresholdC)) {
    throw new Error(
      `toModelSpecies: ${entry.id} has no finite thresholdC; filter with isDisplayableSpecies first`,
    );
  }
  return {
    id: entry.id,
    name: entry.name,
    thresholdC: entry.thresholdC,
    source: entry.source,
    verified: entry.verified,
  };
}
