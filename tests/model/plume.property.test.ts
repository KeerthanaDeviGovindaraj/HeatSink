import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeThermal } from '../../src/model/thermal';
import { excessAt, impacts } from '../../src/model/plume';
import {
  BOUNDS,
  NEGLIGIBLE_C,
  SHALLOW_DEPTH_M,
} from '../../src/model/constants';
import type { SamplePoint, SiteInputs } from '../../src/model/types';

/**
 * Property tests for the screening plume (src/model/plume.ts) and the excess
 * decay it is built on. Covers properties P2, P3, P4, P12, P16 from
 * thermal-model.md v2.1 "Required properties" and requirements.md Requirement 10.
 *
 * These are all pure, grid-free properties: they run `computeThermal` to get a
 * thermal result and then exercise `excessAt` / `impacts` directly, so they are
 * cheap and run with fast-check's default run count.
 */

/**
 * Generator for site inputs constrained to the valid bounds (thermal-model.md).
 * lat/lon do not affect the thermal result, so fixed Massachusetts Bay-ish
 * values are used; only the thermal/hydraulic fields drive `computeThermal`.
 */
const validInputsArb: fc.Arbitrary<SiteInputs> = fc.record({
  lat: fc.constant(42.3),
  lon: fc.constant(-70.7),
  facilityMW: fc.double({
    min: BOUNDS.facilityMW.min,
    max: BOUNDS.facilityMW.max,
    noNaN: true,
    noDefaultInfinity: true,
  }),
  deltaTC: fc.double({
    min: BOUNDS.deltaTC.min,
    max: BOUNDS.deltaTC.max,
    noNaN: true,
    noDefaultInfinity: true,
  }),
  mixRatio: fc.double({
    min: BOUNDS.mixRatio.min,
    max: BOUNDS.mixRatio.max,
    noNaN: true,
    noDefaultInfinity: true,
  }),
  heatFraction: fc.double({
    min: BOUNDS.heatFraction.min,
    max: BOUNDS.heatFraction.max,
    noNaN: true,
    noDefaultInfinity: true,
  }),
});

/** Non-negative distance from the outfall, up to a generous bound (m). */
const distanceArb: fc.Arbitrary<number> = fc.double({
  min: 0,
  max: 1e6,
  noNaN: true,
  noDefaultInfinity: true,
});

/** Depth generator including null (depth unknown) and both shallow/deep water. */
const depthArb: fc.Arbitrary<number | null> = fc.oneof(
  fc.constant<number | null>(null),
  fc.double({ min: 0, max: 200, noNaN: true, noDefaultInfinity: true }),
);

/** Baseline temperature generator including null (no data). */
const baselineArb: fc.Arbitrary<number | null> = fc.oneof(
  fc.constant<number | null>(null),
  fc.double({ min: -2, max: 35, noNaN: true, noDefaultInfinity: true }),
);

/** A sample point with a bounded distance, arbitrary depth and baseline. */
const samplePointArb: fc.Arbitrary<SamplePoint> = fc.record({
  lat: fc.constant(42.3),
  lon: fc.constant(-70.7),
  distanceM: distanceArb,
  baselineC: baselineArb,
  depthM: depthArb,
});

describe('plume properties', () => {
  // Property P2 — non-negative excess. Validates: Requirements 10.2
  // FOR ANY distance r ≥ 0, excessAt(r, thermal) ≥ 0. The decay is
  // deltaTEffC·exp(-r/L) with deltaTEffC ≥ 0 and exp(...) > 0, so it never goes
  // negative.
  it('P2 (R10.2): excessAt(r) ≥ 0 for any r ≥ 0 and any valid inputs', () => {
    fc.assert(
      fc.property(validInputsArb, distanceArb, (inputs, rM) => {
        const thermal = computeThermal(inputs);
        expect(excessAt(rM, thermal)).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  // Property P3 — monotonic decay. Validates: Requirements 10.3
  // FOR ANY r1 < r2, excessAt(r2) ≤ excessAt(r1). exp(-r/L) is non-increasing in
  // r for L > 0, so a larger distance never produces a larger excess.
  it('P3 (R10.3): r1 < r2 ⇒ excessAt(r2) ≤ excessAt(r1)', () => {
    fc.assert(
      fc.property(validInputsArb, distanceArb, distanceArb, (inputs, a, b) => {
        const thermal = computeThermal(inputs);
        const r1 = Math.min(a, b);
        const r2 = Math.max(a, b);
        expect(excessAt(r2, thermal)).toBeLessThanOrEqual(excessAt(r1, thermal));
      }),
    );
  });

  // Property P4 — boundary value. Validates: Requirements 10.4
  // excessAt(0, thermal) == thermal.deltaTEffC exactly: exp(-0/L) = 1, so the
  // excess at the outfall equals the effective temperature rise.
  it('P4 (R10.4): excessAt(0) == deltaTEffC', () => {
    fc.assert(
      fc.property(validInputsArb, (inputs) => {
        const thermal = computeThermal(inputs);
        expect(excessAt(0, thermal)).toBe(thermal.deltaTEffC);
      }),
    );
  });

  // Property P12 — deep-water rule. Validates: Requirements 10.12
  // FOR ANY point with depthM > SHALLOW_DEPTH_M, bottomExcessC == 0. The warm
  // discharge is treated as reaching the bottom only in shallow water; deeper
  // points see no bottom excess (and are flagged deepSurfaceOnly when the excess
  // is non-negligible).
  it('P12 (R10.12): depthM > SHALLOW_DEPTH_M ⇒ bottomExcessC == 0', () => {
    const deepPointArb: fc.Arbitrary<SamplePoint> = fc.record({
      lat: fc.constant(42.3),
      lon: fc.constant(-70.7),
      distanceM: distanceArb,
      baselineC: baselineArb,
      // Strictly deeper than the shallow cutoff.
      depthM: fc.double({
        min: SHALLOW_DEPTH_M + 1e-6,
        max: 1e4,
        noNaN: true,
        noDefaultInfinity: true,
      }),
    });

    fc.assert(
      fc.property(
        validInputsArb,
        fc.array(deepPointArb, { minLength: 1, maxLength: 50 }),
        (inputs, points) => {
          const thermal = computeThermal(inputs);
          for (const impact of impacts(points, thermal)) {
            expect(impact.bottomExcessC).toBe(0);
          }
        },
      ),
    );
  });

  // Property P16 — negligible rule. Validates: Requirements 10.16
  // FOR EVERY point, bottomExcessC == 0 OR bottomExcessC ≥ NEGLIGIBLE_C. Excess
  // below the floor is zeroed before the shallow-water test, so a point never
  // carries a tiny non-zero bottom excess.
  it('P16 (R10.16): every point has bottomExcessC == 0 or ≥ NEGLIGIBLE_C', () => {
    fc.assert(
      fc.property(
        validInputsArb,
        fc.array(samplePointArb, { minLength: 1, maxLength: 50 }),
        (inputs, points) => {
          const thermal = computeThermal(inputs);
          for (const impact of impacts(points, thermal)) {
            expect(
              impact.bottomExcessC === 0 || impact.bottomExcessC >= NEGLIGIBLE_C,
            ).toBe(true);
          }
        },
      ),
    );
  });
});
