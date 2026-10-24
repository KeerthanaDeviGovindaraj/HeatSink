import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeThermal } from '../../src/model/thermal';
import { impacts } from '../../src/model/plume';
import { coverage, plumeAreaKm2, speciesRisk } from '../../src/model/risk';
import {
  BOUNDS,
  NEGLIGIBLE_C,
  POINT_AREA_KM2,
  R_REF_M,
} from '../../src/model/constants';
import type {
  SamplePoint,
  SiteInputs,
  Species,
} from '../../src/model/types';

/**
 * Property tests for risk/scoring (src/model/risk.ts) plus the newly-exceeded
 * half of P16. Covers P7, P9, P13, P14 and the "every newly exceeded point is a
 * plume point" clause of P16 from thermal-model.md v2.1 and requirements.md R10.
 *
 * Performance note: these properties exercise the plume → impacts → risk
 * pipeline, which is deterministic and cheap PER POINT, so instead of calling
 * the full ~25,900-point `samplePoints` grid (R_REF_M / SAMPLE_SPACING_M on each
 * axis) we build SMALL synthetic SamplePoint arrays and run the REAL
 * `computeThermal` + `impacts` + `risk` functions over them. This tests the same
 * code paths the UI uses while keeping each property fast. P15 (the land rule,
 * which needs the real grid) lives in grid.property.test.ts with a reduced run
 * count.
 */

/** Theoretical maximum plume area: the whole sampling disc, in km². */
const MAX_DISC_KM2 = Math.PI * (R_REF_M / 1000) * (R_REF_M / 1000);

/** Valid bounded thermal/hydraulic inputs (lat/lon do not affect the result). */
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

/** A sample point: bounded distance, depth (incl. null), baseline (incl. null). */
const samplePointArb: fc.Arbitrary<SamplePoint> = fc.record({
  lat: fc.constant(42.3),
  lon: fc.constant(-70.7),
  // Distances within the sampling disc so excess can be meaningful.
  distanceM: fc.double({ min: 0, max: R_REF_M, noNaN: true, noDefaultInfinity: true }),
  baselineC: fc.oneof(
    fc.constant<number | null>(null),
    fc.double({ min: -2, max: 35, noNaN: true, noDefaultInfinity: true }),
  ),
  depthM: fc.oneof(
    fc.constant<number | null>(null),
    fc.double({ min: 0, max: 200, noNaN: true, noDefaultInfinity: true }),
  ),
});

/** A small synthetic grid of sample points (keeps properties fast). */
const sampleGridArb: fc.Arbitrary<SamplePoint[]> = fc.array(samplePointArb, {
  minLength: 0,
  maxLength: 60,
});

/** A species with a threshold inside the realistic seawater range. */
const speciesArb: fc.Arbitrary<Species> = fc.record({
  id: fc.constant('sp'),
  name: fc.constant('Test species'),
  thresholdC: fc.double({ min: -2, max: 35, noNaN: true, noDefaultInfinity: true }),
  source: fc.constant('synthetic'),
  verified: fc.constant(false),
});

describe('risk properties', () => {
  // Property P7 — never colder. Validates: Requirements 10.7
  // FOR ANY sample point with baseline data, combinedC ≥ baselineC. The bottom
  // excess is always ≥ 0 and combinedC = baselineC + bottomExcessC, so the
  // discharge never cools a point below its baseline.
  it('P7 (R10.7): combinedC ≥ baselineC at every point with baseline data', () => {
    fc.assert(
      fc.property(validInputsArb, sampleGridArb, (inputs, grid) => {
        const thermal = computeThermal(inputs);
        for (const impact of impacts(grid, thermal)) {
          if (impact.baselineC === null) continue;
          expect(impact.combinedC).not.toBeNull();
          expect(impact.combinedC as number).toBeGreaterThanOrEqual(
            impact.baselineC,
          );
        }
      }),
    );
  });

  // Property P9 — score bounds and monotonicity. Validates: Requirements 10.9
  // (a) 0 ≤ score ≤ 100 for any valid inputs.
  // (b) Raising facilityMW OR heatFraction (all else equal) does NOT lower the
  //     score: more heat ⇒ larger/stronger plume ⇒ newly exceeded area cannot
  //     shrink ⇒ the area-based score is non-decreasing.
  // The grid is held fixed between the base and increased cases so "all else
  // equal" holds and only the thermal field changes.
  it('P9 (R10.9): 0 ≤ score ≤ 100 and score non-decreasing in MW and heatFraction', () => {
    fc.assert(
      fc.property(
        fc.record({
          // Keep headroom so the increased values stay within bounds.
          facilityMW: fc.double({
            min: BOUNDS.facilityMW.min,
            max: BOUNDS.facilityMW.max - 1,
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
            max: BOUNDS.heatFraction.max - 0.01,
            noNaN: true,
            noDefaultInfinity: true,
          }),
        }),
        sampleGridArb,
        speciesArb,
        ({ facilityMW, deltaTC, mixRatio, heatFraction }, grid, species) => {
          const base: SiteInputs = {
            lat: 42.3,
            lon: -70.7,
            facilityMW,
            deltaTC,
            mixRatio,
            heatFraction,
          };

          const riskFor = (inputs: SiteInputs) =>
            speciesRisk(impacts(grid, computeThermal(inputs)), species);

          const baseRisk = riskFor(base);

          // (a) bounds.
          expect(baseRisk.score).toBeGreaterThanOrEqual(0);
          expect(baseRisk.score).toBeLessThanOrEqual(100);

          // (b) monotonicity: more MW and more heatFraction never lower score.
          const moreMW = riskFor({ ...base, facilityMW: facilityMW + 1 });
          const moreHF = riskFor({ ...base, heatFraction: heatFraction + 0.01 });

          // Allow a tiny float tolerance; the relationship is non-strict.
          expect(moreMW.score).toBeGreaterThanOrEqual(baseRisk.score - 1e-9);
          expect(moreHF.score).toBeGreaterThanOrEqual(baseRisk.score - 1e-9);
        },
      ),
    );
  });

  // Property P13 — area consistency. Validates: Requirements 10.13
  // 0 ≤ newlyExceededKm2 ≤ plumeAreaKm2 ≤ π·(R_REF_M/1000)², and
  // newlyExceededKm2 + alreadyExceededKm2 ≤ total water area with baseline data.
  // Newly exceeded points are a subset of plume points (they require a
  // non-negligible excess to cross the threshold), and newly + already exceeded
  // points are a subset of points that have baseline data.
  it('P13 (R10.13): area ordering and the newly+already ≤ data-area bound hold', () => {
    fc.assert(
      fc.property(validInputsArb, sampleGridArb, speciesArb, (inputs, grid, species) => {
        const thermal = computeThermal(inputs);
        const points = impacts(grid, thermal);
        const plume = plumeAreaKm2(points);
        const risk = speciesRisk(points, species);

        // Total water area that has baseline data.
        let withData = 0;
        for (const p of points) if (p.baselineC !== null) withData++;
        const dataAreaKm2 = withData * POINT_AREA_KM2;

        expect(risk.newlyExceededKm2).toBeGreaterThanOrEqual(0);
        expect(risk.newlyExceededKm2).toBeLessThanOrEqual(plume);
        expect(plume).toBeLessThanOrEqual(MAX_DISC_KM2);
        expect(risk.newlyExceededKm2 + risk.alreadyExceededKm2).toBeLessThanOrEqual(
          dataAreaKm2,
        );
      }),
    );
  });

  // Property P14 — zero-impact and coverage range. Validates: Requirements 10.14
  // If newlyExceededKm2 == 0 then score == 0 (the area-based score is exactly 0
  // when no area is pushed past the threshold), and coverage ∈ [0, 1] for any
  // site (including the empty-grid case, where coverage is defined as 1).
  it('P14 (R10.14): newlyExceededKm2 == 0 ⇒ score == 0, and coverage ∈ [0, 1]', () => {
    fc.assert(
      fc.property(validInputsArb, sampleGridArb, speciesArb, (inputs, grid, species) => {
        const thermal = computeThermal(inputs);
        const points = impacts(grid, thermal);
        const risk = speciesRisk(points, species);
        const cov = coverage(points);

        if (risk.newlyExceededKm2 === 0) {
          expect(risk.score).toBe(0);
        }
        expect(cov).toBeGreaterThanOrEqual(0);
        expect(cov).toBeLessThanOrEqual(1);
      }),
    );
  });

  // Property P16 (newly-exceeded clause) — Validates: Requirements 10.16
  // Every newly exceeded point is also a plume point: to become newly exceeded a
  // point's combinedC must cross the threshold, which requires a non-zero bottom
  // excess, which (by the negligible rule) requires excessC ≥ NEGLIGIBLE_C — the
  // definition of a plume point. We verify the count of newly exceeded points
  // never exceeds the count of plume points, consistent with newlyExceededKm2 ≤
  // plumeAreaKm2, and that each individual newly exceeded point has
  // excessC ≥ NEGLIGIBLE_C.
  it('P16 (R10.16): every newly exceeded point is a plume point (excessC ≥ NEGLIGIBLE_C)', () => {
    fc.assert(
      fc.property(validInputsArb, sampleGridArb, speciesArb, (inputs, grid, species) => {
        const thermal = computeThermal(inputs);
        const points = impacts(grid, thermal);
        const T = species.thresholdC;

        for (const p of points) {
          const isNewlyExceeded =
            p.baselineC !== null &&
            p.baselineC < T &&
            p.combinedC !== null &&
            p.combinedC >= T;
          if (isNewlyExceeded) {
            // A newly exceeded point must carry a non-negligible excess: its
            // combinedC rose past T only because bottomExcessC > 0, which the
            // negligible rule permits only when excessC ≥ NEGLIGIBLE_C.
            expect(p.excessC).toBeGreaterThanOrEqual(NEGLIGIBLE_C);
            expect(p.bottomExcessC).toBeGreaterThanOrEqual(NEGLIGIBLE_C);
          }
        }
      }),
    );
  });
});
