import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { fromMGD, toMGD } from '../../src/model/units';

describe('units', () => {
  // Property P10 — units round trip. Validates: Requirements 10.1
  // FOR ANY non-negative x, toMGD(fromMGD(x)) equals x within floating-point tolerance.
  // The round trip is a multiply then divide by the same constant, so the relative
  // error is bounded by a few ULPs; a small relative tolerance holds across the range.
  it('P10: toMGD(fromMGD(x)) ≈ x for any non-negative x (R10.1)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: Number.MAX_VALUE, noNaN: true, noDefaultInfinity: true }),
        (x) => {
          const roundTripped = toMGD(fromMGD(x));
          // Relative tolerance for a multiply-then-divide round trip; absolute
          // fallback covers x near 0 where relative error is undefined.
          const tolerance = Math.max(1e-9 * x, 1e-12);
          expect(Math.abs(roundTripped - x)).toBeLessThanOrEqual(tolerance);
        },
      ),
    );
  });
});
