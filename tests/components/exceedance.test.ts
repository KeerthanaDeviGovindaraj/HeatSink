import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { classifyPoint } from '../../src/components/exceedance';
import { speciesRisk } from '../../src/model/risk';
import { POINT_AREA_KM2 } from '../../src/model/constants';
import type { PointImpact, Species } from '../../src/model/types';

/**
 * Tests for the pure exceedance classifier (src/components/exceedance.ts, R5.4).
 * The vitest env is `node` and @testing-library/react is not installed, so the
 * overlay logic lives in a pure helper tested here directly — no DOM, no
 * Leaflet. Both unit examples (specific cases/edges) and properties (universal
 * guarantees + agreement with the model's speciesRisk counts) are covered.
 */

/** Build a minimal PointImpact; only baselineC/combinedC matter to classifyPoint. */
function impact(
  baselineC: number | null,
  combinedC: number | null,
): PointImpact {
  return {
    lat: 42.3,
    lon: -70.7,
    distanceM: 0,
    baselineC,
    depthM: null,
    excessC: 0,
    bottomExcessC: 0,
    combinedC,
    deepSurfaceOnly: false,
  };
}

describe('classifyPoint (R5.4)', () => {
  const T = 20;

  it('is "already" when baseline is at or above the threshold', () => {
    expect(classifyPoint(impact(20, 20), T)).toBe('already'); // exactly at T*
    expect(classifyPoint(impact(21, 23), T)).toBe('already'); // above T*
    // Already takes precedence even if combined is also above.
    expect(classifyPoint(impact(25, 30), T)).toBe('already');
  });

  it('is "newly" when baseline is below but combined reaches the threshold', () => {
    expect(classifyPoint(impact(19, 20), T)).toBe('newly'); // combined exactly at T*
    expect(classifyPoint(impact(18, 22), T)).toBe('newly'); // combined above T*
  });

  it('is "none" when combined stays below the threshold', () => {
    expect(classifyPoint(impact(18, 19.9), T)).toBe('none');
    expect(classifyPoint(impact(10, 10), T)).toBe('none');
  });

  it('is "none" when there is no baseline data (null baseline)', () => {
    expect(classifyPoint(impact(null, 30), T)).toBe('none');
    expect(classifyPoint(impact(null, null), T)).toBe('none');
  });

  it('is "none" when baseline is below T* and combined is unknown (null)', () => {
    expect(classifyPoint(impact(18, null), T)).toBe('none');
  });
});

/** A point impact with bounded, possibly-null temperatures. */
const impactArb: fc.Arbitrary<PointImpact> = fc
  .record({
    baselineC: fc.oneof(
      fc.constant<number | null>(null),
      fc.double({ min: -2, max: 35, noNaN: true, noDefaultInfinity: true }),
    ),
    combinedC: fc.oneof(
      fc.constant<number | null>(null),
      fc.double({ min: -2, max: 45, noNaN: true, noDefaultInfinity: true }),
    ),
  })
  .map(({ baselineC, combinedC }) => impact(baselineC, combinedC));

const thresholdArb = fc.double({
  min: -2,
  max: 35,
  noNaN: true,
  noDefaultInfinity: true,
});

describe('classifyPoint properties (R5.4)', () => {
  it('a point is never both newly and already exceeded (outcomes are exclusive)', () => {
    fc.assert(
      fc.property(impactArb, thresholdArb, (p, T) => {
        const kind = classifyPoint(p, T);
        expect(['newly', 'already', 'none']).toContain(kind);
        // Exclusivity is structural: a single return value can't be two kinds.
        // Re-derive the booleans and assert they can't both hold.
        const already = p.baselineC !== null && p.baselineC >= T;
        const newly =
          p.baselineC !== null &&
          p.baselineC < T &&
          p.combinedC !== null &&
          p.combinedC >= T;
        expect(already && newly).toBe(false);
        if (already) expect(kind).toBe('already');
        else if (newly) expect(kind).toBe('newly');
        else expect(kind).toBe('none');
      }),
    );
  });

  it('agrees with speciesRisk: summed counts match newly/already areas', () => {
    // The overlay classifier and the scored areas must agree on what counts as
    // newly vs already exceeded. Sum classifyPoint over the points and compare
    // to speciesRisk's area figures (count × per-point area).
    const grid = fc.array(impactArb, { minLength: 0, maxLength: 80 });
    fc.assert(
      fc.property(grid, thresholdArb, (points, T) => {
        const species: Species = {
          id: 'sp',
          name: 'Test',
          thresholdC: T,
          source: 'synthetic',
          verified: false,
        };
        let newly = 0;
        let already = 0;
        for (const p of points) {
          const kind = classifyPoint(p, T);
          if (kind === 'newly') newly++;
          else if (kind === 'already') already++;
        }
        const risk = speciesRisk(points, species);
        expect(risk.newlyExceededKm2).toBeCloseTo(newly * POINT_AREA_KM2, 12);
        expect(risk.alreadyExceededKm2).toBeCloseTo(
          already * POINT_AREA_KM2,
          12,
        );
      }),
    );
  });
});
