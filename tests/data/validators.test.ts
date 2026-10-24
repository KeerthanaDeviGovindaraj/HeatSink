import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { isUsableSpecies } from '../../src/data/validators';
import type { SpeciesEntry } from '../../src/data/types';

describe('species validators', () => {
  // A species is hidden unless it is verified AND cited AND has a numeric threshold.
  it('only accepts verified, cited, numeric-threshold species', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string(),
          name: fc.string(),
          thresholdC: fc.option(fc.double({ noNaN: true }), { nil: null }),
          source: fc.string(),
          verified: fc.boolean(),
        }),
        (entry: SpeciesEntry) => {
          const usable = isUsableSpecies(entry);
          if (usable) {
            expect(entry.verified).toBe(true);
            expect(entry.source.trim().length).toBeGreaterThan(0);
            expect(typeof entry.thresholdC).toBe('number');
          }
        },
      ),
    );
  });

  it('hides the placeholder species.json entries', () => {
    expect(
      isUsableSpecies({
        id: 'american-lobster',
        name: 'American lobster',
        thresholdC: null,
        source: '',
        verified: false,
      }),
    ).toBe(false);
  });
});
