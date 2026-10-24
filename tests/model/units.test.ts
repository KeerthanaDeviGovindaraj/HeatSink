import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { fromMGD, toMGD } from '../../src/model/units';

describe('units', () => {
  // Property 10: units round trip.
  it('toMGD(fromMGD(x)) ≈ x', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1e6, noNaN: true }), (x) => {
        expect(toMGD(fromMGD(x))).toBeCloseTo(x, 6);
      }),
    );
  });
});
