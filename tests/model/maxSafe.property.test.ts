import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { FeatureCollection } from 'geojson';
import { maxSafeMW } from '../../src/model/maxSafe';
import { samplePoints, isOutfallOnLand, type LatLon } from '../../src/model/grid';
import { impacts } from '../../src/model/plume';
import { speciesRisk } from '../../src/model/risk';
import { computeThermal } from '../../src/model/thermal';
import { BOUNDS } from '../../src/model/constants';
import type { BaselineCell, SiteInputs, Species } from '../../src/model/types';

/**
 * Property tests for the largest-safe-size search (src/model/maxSafe.ts),
 * covering P17 and P18 from thermal-model.md v2.2 and requirements.md R10 items
 * 20 (P17) and 21 (P18). Satisfies R10.20, R10.21.
 *
 * Performance note: `maxSafeMW` internally builds the REAL ~25,900-point
 * `samplePoints` grid (R_REF_M / SAMPLE_SPACING_M on each axis, land mask /
 * point-in-polygon paid once) and then runs ~10 candidate evaluations
 * (binary search + two boundary checks) over those reused points. Each call is
 * therefore heavy, and P18(b) calls it twice per case. We keep `numRuns` small
 * (8–12, documented at each `fc.assert`), the selected-species list tiny (1–2),
 * and land empty — this gives wide outfall/threshold coverage without a slow
 * loop. The grid is deterministic, so a handful of varied scenarios suffices.
 *
 * Branch coverage: thresholdC is generated across a realistic seawater range and
 * baseline temps / heat intensity vary, so across the run set we hit all three
 * result branches — null (even 1 MW not Low), a mid-range n (n safe, n+1 not),
 * and 500 (whole range Low). The properties below hold regardless of which
 * branch a given case lands in, including the vacuous "no selected species"
 * case (which always yields maxMW = 500).
 */

/** Land is empty for these properties; we only need a water outfall. */
const EMPTY_LAND: FeatureCollection = { type: 'FeatureCollection', features: [] };

/** MW search bounds, single-sourced from BOUNDS (match maxSafe.ts). */
const MIN_MW = BOUNDS.facilityMW.min;
const MAX_MW = BOUNDS.facilityMW.max;

/**
 * A scenario: a water outfall in Massachusetts Bay, fixed bounded hydraulic
 * settings, a couple of baseline cells near the outfall (so the plume has data
 * and coverage can be meaningful), and 1–2 species whose thresholds straddle the
 * baseline temperatures. `facilityMW` is included but is expected to be ignored
 * by maxSafeMW (P18b) — we still generate it to prove independence.
 */
interface Scenario {
  inputs: SiteInputs;
  cells: BaselineCell[];
  species: Species[];
  speciesIds: string[];
}

const scenarioArb: fc.Arbitrary<Scenario> = fc
  .record({
    lat: fc.double({ min: 42.0, max: 42.5, noNaN: true, noDefaultInfinity: true }),
    lon: fc.double({ min: -70.9, max: -70.4, noNaN: true, noDefaultInfinity: true }),
    facilityMW: fc.double({
      min: MIN_MW,
      max: MAX_MW,
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
    // Baseline temperatures near the outfall, inside the valid seawater range.
    baselineC: fc.double({ min: 5, max: 24, noNaN: true, noDefaultInfinity: true }),
    depthM: fc.oneof(
      fc.constant<number | null>(null),
      fc.double({ min: 0, max: 40, noNaN: true, noDefaultInfinity: true }),
    ),
    // Species thresholds straddling the baseline so Low/not-Low transitions
    // across the MW range are actually exercised in many cases.
    thresholds: fc.array(
      fc.double({ min: 6, max: 30, noNaN: true, noDefaultInfinity: true }),
      { minLength: 0, maxLength: 2 },
    ),
  })
  .map((r): Scenario => {
    const inputs: SiteInputs = {
      lat: r.lat,
      lon: r.lon,
      facilityMW: r.facilityMW,
      deltaTC: r.deltaTC,
      mixRatio: r.mixRatio,
      heatFraction: r.heatFraction,
    };
    // Two baseline cells straddling the outfall so the fine grid has data.
    const cells: BaselineCell[] = [
      {
        id: 'c0',
        lat: r.lat,
        lon: r.lon,
        tempC: r.baselineC,
        nObs: 10,
        depthM: r.depthM,
      },
      {
        id: 'c1',
        lat: r.lat + 0.03,
        lon: r.lon + 0.03,
        tempC: r.baselineC,
        nObs: 10,
        depthM: r.depthM,
      },
    ];
    const species: Species[] = r.thresholds.map((t, i) => ({
      id: `sp${i}`,
      name: `Test species ${i}`,
      thresholdC: t,
      source: 'synthetic',
      verified: false,
    }));
    const speciesIds = species.map((s) => s.id);
    return { inputs, cells, species, speciesIds };
  });

/**
 * Re-derive whether EVERY selected species scores Low at a given MW, reusing the
 * SAME sample grid maxSafeMW would build. Mirrors maxSafe.ts internals so the
 * property checks the result against an independent recomputation.
 */
function allSelectedLowAtMW(scenario: Scenario, mw: number, samples: ReturnType<typeof samplePoints>): boolean {
  const selected = new Set(scenario.speciesIds);
  const thermal = computeThermal({ ...scenario.inputs, facilityMW: mw });
  const points = impacts(samples, thermal);
  return scenario.species
    .filter((s) => selected.has(s.id))
    .every((s) => speciesRisk(points, s).level === 'Low');
}

describe('maxSafe properties', () => {
  // Property P17 — max-safe correctness. Validates: Requirements 10.20
  // FOR ANY site and settings, if maxSafeMW returns n (n !== null) then at
  // MW = n EVERY selected species scores Low, AND (n === MAX_MW OR at MW = n+1
  // some selected species is NOT Low). We recompute over the SAME sample grid
  // the search uses: build samplePoints once, then assert all selected species
  // are 'Low' at n, and either n is the upper bound or at least one species is
  // not 'Low' at n+1 (the search must have stopped at the true boundary).
  it('P17 (R10.20): if maxSafeMW returns n then n is Low and (n == 500 or n+1 is not Low)', () => {
    fc.assert(
      fc.property(scenarioArb, (scenario) => {
        const outfall: LatLon = { lat: scenario.inputs.lat, lon: scenario.inputs.lon };
        fc.pre(!isOutfallOnLand(outfall, EMPTY_LAND));

        const { maxMW } = maxSafeMW(
          scenario.inputs,
          scenario.cells,
          scenario.species,
          EMPTY_LAND,
          scenario.speciesIds,
        );

        // P17 only constrains the non-null branch; the null branch is P18.
        if (maxMW === null) return;

        // n is an integer within bounds.
        expect(Number.isInteger(maxMW)).toBe(true);
        expect(maxMW).toBeGreaterThanOrEqual(MIN_MW);
        expect(maxMW).toBeLessThanOrEqual(MAX_MW);

        // Reuse one sample grid for the independent recomputation.
        const samples = samplePoints(outfall, scenario.cells, EMPTY_LAND);

        // Every selected species scores Low at n.
        expect(allSelectedLowAtMW(scenario, maxMW, samples)).toBe(true);

        // Boundary: either n is the upper bound, or n+1 is not all-Low.
        if (maxMW !== MAX_MW) {
          expect(allSelectedLowAtMW(scenario, maxMW + 1, samples)).toBe(false);
        }
      }),
      // Each case builds the real ~25.9k-point grid and runs ~10 evaluations
      // inside maxSafeMW plus two recomputations here; keep the run count low.
      { numRuns: 12 },
    );
  });

  // Property P18(a) — null case iff not-Low at 1 MW. Validates: Requirements 10.21
  // maxSafeMW returns maxMW === null IF AND ONLY IF some selected species is NOT
  // Low at MW = MIN_MW. Both directions:
  //   - if result is null, then at 1 MW some selected species isn't Low;
  //   - if at 1 MW all selected species are Low, then result is not null.
  it('P18 (R10.21): maxMW is null iff some selected species is not Low at 1 MW', () => {
    fc.assert(
      fc.property(scenarioArb, (scenario) => {
        const outfall: LatLon = { lat: scenario.inputs.lat, lon: scenario.inputs.lon };
        fc.pre(!isOutfallOnLand(outfall, EMPTY_LAND));

        const { maxMW } = maxSafeMW(
          scenario.inputs,
          scenario.cells,
          scenario.species,
          EMPTY_LAND,
          scenario.speciesIds,
        );

        const samples = samplePoints(outfall, scenario.cells, EMPTY_LAND);
        const allLowAtMin = allSelectedLowAtMW(scenario, MIN_MW, samples);

        // Biconditional: null ⇔ NOT all-Low at the minimum size.
        expect(maxMW === null).toBe(!allLowAtMin);
      }),
      { numRuns: 12 },
    );
  });

  // Property P18(b) — facilityMW independence. Validates: Requirements 10.21
  // The result does NOT depend on inputs.facilityMW: for the same
  // site/settings/species, maxSafeMW with two different facilityMW values
  // returns the SAME maxMW and the same coverage (the search always spans
  // [1, 500] regardless of the incoming facilityMW).
  it('P18 (R10.21): result does not depend on the facilityMW passed in', () => {
    fc.assert(
      fc.property(
        scenarioArb,
        fc.double({ min: MIN_MW, max: MAX_MW, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: MIN_MW, max: MAX_MW, noNaN: true, noDefaultInfinity: true }),
        (scenario, mwA, mwB) => {
          const outfall: LatLon = { lat: scenario.inputs.lat, lon: scenario.inputs.lon };
          fc.pre(!isOutfallOnLand(outfall, EMPTY_LAND));

          const run = (facilityMW: number) =>
            maxSafeMW(
              { ...scenario.inputs, facilityMW },
              scenario.cells,
              scenario.species,
              EMPTY_LAND,
              scenario.speciesIds,
            );

          const a = run(mwA);
          const b = run(mwB);

          // Same largest safe size (including the null branch) ...
          expect(a.maxMW).toBe(b.maxMW);
          // ... and same reported coverage (byte-for-byte; same geometry).
          expect(a.coverage).toBe(b.coverage);
        },
      ),
      // Two heavy maxSafeMW calls per case; keep the run count low.
      { numRuns: 8 },
    );
  });
});
