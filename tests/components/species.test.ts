import { describe, it, expect } from 'vitest';
import {
  displayableSpecies,
  isDisplayableSpecies,
  toModelSpecies,
} from '../../src/components/species';
import { isUsableSpecies } from '../../src/data/validators';
import type { SpeciesEntry } from '../../src/data/types';

/**
 * Tests for the SpeciesPicker display rule (R5.2/R5.3) and the model adapter.
 * The key point: display (picker) differs from usable (scoring gate). A species
 * with a source + finite threshold is DISPLAYED even when unverified (R5.3);
 * only a missing source hides it (R5.2).
 */

function entry(over: Partial<SpeciesEntry> = {}): SpeciesEntry {
  return {
    id: 'lobster',
    name: 'American lobster',
    thresholdC: 20,
    source: 'Some citable source',
    verified: false,
    ...over,
  };
}

describe('isDisplayableSpecies (R5.2, R5.3)', () => {
  it('shows a species with a source and finite threshold, even when unverified (R5.3)', () => {
    expect(isDisplayableSpecies(entry({ verified: false }))).toBe(true);
    expect(isDisplayableSpecies(entry({ verified: true }))).toBe(true);
  });

  it('hides a species with no source (R5.2)', () => {
    expect(isDisplayableSpecies(entry({ source: '' }))).toBe(false);
    expect(isDisplayableSpecies(entry({ source: '   ' }))).toBe(false);
  });

  it('hides a species with a null or non-finite threshold', () => {
    expect(isDisplayableSpecies(entry({ thresholdC: null }))).toBe(false);
    expect(isDisplayableSpecies(entry({ thresholdC: NaN }))).toBe(false);
  });

  it('differs from isUsableSpecies: an unverified entry is displayable but not usable', () => {
    const unverified = entry({ verified: false });
    // Display rule shows it (R5.3 badge); scoring gate excludes it.
    expect(isDisplayableSpecies(unverified)).toBe(true);
    expect(isUsableSpecies(unverified)).toBe(false);
  });
});

describe('displayableSpecies (R5.2, R5.3)', () => {
  it('keeps sourced entries (incl. unverified) and drops sourceless ones', () => {
    const list = [
      entry({ id: 'a', source: 'ok', verified: false }),
      entry({ id: 'b', source: '', verified: true }),
      entry({ id: 'c', thresholdC: null }),
      entry({ id: 'd', source: 'ok', verified: true }),
    ];
    expect(displayableSpecies(list).map((s) => s.id)).toEqual(['a', 'd']);
  });
});

describe('toModelSpecies', () => {
  it('narrows a displayable entry to the model Species shape', () => {
    const e = entry({ verified: false });
    expect(toModelSpecies(e)).toEqual({
      id: 'lobster',
      name: 'American lobster',
      thresholdC: 20,
      source: 'Some citable source',
      verified: false,
    });
  });

  it('throws on a non-displayable (null-threshold) entry rather than coercing to 0', () => {
    expect(() => toModelSpecies(entry({ thresholdC: null }))).toThrow();
  });
});
