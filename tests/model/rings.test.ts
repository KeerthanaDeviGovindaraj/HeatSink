import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeThermal } from '../../src/model/thermal';
import {
  excessAt,
  plumeRings,
  ringRadiusM,
  summarizePoints,
} from '../../src/model/plume';
import { BOUNDS, NEGLIGIBLE_C } from '../../src/model/constants';
import type { PointImpact, SiteInputs } from '../../src/model/types';

/**
 * Unit + property tests for the task 6.3 plume-ring and results-summary helpers
 * (ringRadiusM, plumeRings, summarizePoints). These are pure, UI-free helpers:
 * the UI (MapView, PlumePanel) draws from them but the logic is tested here.
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

/** A representative mid-range facility for concrete numeric checks. */
const SAMPLE_INPUTS: SiteInputs = {
  lat: 42.3,
  lon: -70.7,
  facilityMW: 100,
  deltaTC: 4,
  mixRatio: 0,
  heatFraction: 0.88,
};

describe('ringRadiusM', () => {
  it('returns 0 when the level meets or exceeds the source strength', () => {
    const thermal = computeThermal(SAMPLE_INPUTS);
    expect(ringRadiusM(thermal, thermal.deltaTEffC)).toBe(0);
    expect(ringRadiusM(thermal, thermal.deltaTEffC + 1)).toBe(0);
  });

  it('returns 0 for a non-positive level', () => {
    const thermal = computeThermal(SAMPLE_INPUTS);
    expect(ringRadiusM(thermal, 0)).toBe(0);
    expect(ringRadiusM(thermal, -1)).toBe(0);
  });

  it('inverts excessAt: excess at the ring radius equals the level', () => {
    const thermal = computeThermal(SAMPLE_INPUTS);
    const level = 1;
    const r = ringRadiusM(thermal, level);
    expect(r).toBeGreaterThan(0);
    expect(excessAt(r, thermal)).toBeCloseTo(level, 9);
  });

  it('equals the thermal reach at the negligible level', () => {
    const thermal = computeThermal(SAMPLE_INPUTS);
    expect(ringRadiusM(thermal, NEGLIGIBLE_C)).toBeCloseTo(thermal.reachM, 6);
  });

  it('is monotonic: a higher level yields a smaller (or equal) radius', () => {
    fc.assert(
      fc.property(validInputsArb, (inputs) => {
        const thermal = computeThermal(inputs);
        const levels = [2, 1, 0.5, NEGLIGIBLE_C];
        const radii = levels.map((l) => ringRadiusM(thermal, l));
        for (let i = 1; i < radii.length; i++) {
          // levels decrease, so radii must be non-decreasing.
          expect(radii[i]).toBeGreaterThanOrEqual(radii[i - 1]);
        }
      }),
    );
  });

  it('matches excessAt at the ring radius for any reachable level', () => {
    fc.assert(
      fc.property(
        validInputsArb,
        fc.double({ min: NEGLIGIBLE_C, max: 9, noNaN: true, noDefaultInfinity: true }),
        (inputs, level) => {
          const thermal = computeThermal(inputs);
          const r = ringRadiusM(thermal, level);
          if (r > 0) {
            expect(excessAt(r, thermal)).toBeCloseTo(level, 6);
          }
        },
      ),
    );
  });
});

describe('plumeRings', () => {
  it('keeps only reachable levels and preserves input order', () => {
    const thermal = computeThermal(SAMPLE_INPUTS);
    // deltaTEffC is 4 here, so a 4 °C level is not reachable (radius 0) and is
    // dropped; 2, 1, 0.5, 0.1 are all reachable.
    const rings = plumeRings(thermal, [thermal.deltaTEffC, 2, 1, 0.5, NEGLIGIBLE_C]);
    expect(rings.map((r) => r.excessC)).toEqual([2, 1, 0.5, NEGLIGIBLE_C]);
    for (const ring of rings) {
      expect(ring.radiusM).toBeGreaterThan(0);
      expect(ring.radiusM).toBeCloseTo(ringRadiusM(thermal, ring.excessC), 9);
    }
  });

  it('returns an empty list when no level is reachable', () => {
    const thermal = computeThermal(SAMPLE_INPUTS);
    expect(plumeRings(thermal, [thermal.deltaTEffC, thermal.deltaTEffC + 5])).toEqual([]);
  });
});

/** Build a minimal PointImpact for summarize tests. */
function impactOf(
  excessC: number,
  depthM: number | null,
  deepSurfaceOnly: boolean,
): PointImpact {
  return {
    lat: 42,
    lon: -70,
    distanceM: 0,
    baselineC: 10,
    depthM,
    excessC,
    bottomExcessC: deepSurfaceOnly ? 0 : excessC,
    combinedC: 10 + (deepSurfaceOnly ? 0 : excessC),
    deepSurfaceOnly,
  };
}

describe('summarizePoints', () => {
  it('counts plume points, deep "surface only", and unknown-depth points', () => {
    const points: PointImpact[] = [
      impactOf(2, 10, false), // plume, shallow, known depth
      impactOf(1.5, 50, true), // plume, deep surface-only
      impactOf(0.8, null, false), // plume, depth unknown
      impactOf(0.05, 10, false), // below negligible → not a plume point
    ];
    expect(summarizePoints(points)).toEqual({
      plumePointCount: 3,
      deepSurfaceOnlyCount: 1,
      unknownDepthCount: 1,
    });
  });

  it('returns all zeros for an empty input', () => {
    expect(summarizePoints([])).toEqual({
      plumePointCount: 0,
      deepSurfaceOnlyCount: 0,
      unknownDepthCount: 0,
    });
  });

  it('never counts sub-helpers above the plume total', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            excessC: fc.double({ min: 0, max: 5, noNaN: true, noDefaultInfinity: true }),
            depthM: fc.option(
              fc.double({ min: 0, max: 200, noNaN: true, noDefaultInfinity: true }),
              { nil: null },
            ),
            deepSurfaceOnly: fc.boolean(),
          }),
        ),
        (specs) => {
          const points = specs.map((s) => impactOf(s.excessC, s.depthM, s.deepSurfaceOnly));
          const summary = summarizePoints(points);
          expect(summary.deepSurfaceOnlyCount).toBeLessThanOrEqual(summary.plumePointCount);
          expect(summary.unknownDepthCount).toBeLessThanOrEqual(summary.plumePointCount);
          expect(summary.plumePointCount).toBeLessThanOrEqual(points.length);
        },
      ),
    );
  });
});
