import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeThermal } from '../../src/model/thermal';
import { excessAt, impacts } from '../../src/model/plume';
import {
  cumulativeImpacts,
  maxIndividualExcessC,
  projectSiteOntoGrid,
  type CumulativeSite,
} from '../../src/model/cumulative';
import { haversineM } from '../../src/model/grid';
import { BOUNDS, R_REF_M } from '../../src/model/constants';
import type { SamplePoint, SiteInputs } from '../../src/model/types';

/**
 * Property tests for cumulative superposition (src/model/cumulative.ts). Covers
 * Property P8 from thermal-model.md v2.1 "Required properties" and
 * requirements.md R10.8, plus single-site and empty-set sanity.
 *
 * Performance: like the other model property tests, these exercise the REAL
 * `cumulativeImpacts` / `maxIndividualExcessC` pipeline over SMALL synthetic
 * shared grids (a handful of points) rather than the full ~25,900-point grid.
 * The physics is per-point, so a small grid tests the same code paths cheaply.
 */

/** Valid bounded thermal/hydraulic inputs; lat/lon chosen per-site below. */
function inputsArb(lat: number, lon: number): fc.Arbitrary<SiteInputs> {
  return fc.record({
    lat: fc.constant(lat),
    lon: fc.constant(lon),
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
}

/** A site: a Massachusetts Bay-ish outfall plus a thermal result. */
const siteArb: fc.Arbitrary<CumulativeSite> = fc
  .record({
    lat: fc.double({ min: 42.0, max: 42.6, noNaN: true, noDefaultInfinity: true }),
    lon: fc.double({ min: -70.9, max: -70.3, noNaN: true, noDefaultInfinity: true }),
  })
  .chain(({ lat, lon }) =>
    inputsArb(lat, lon).map((inputs) => ({
      outfall: { lat, lon },
      thermal: computeThermal(inputs),
    })),
  );

/** A shared sample point. baseline/depth can be null (no data / unknown). */
const samplePointArb: fc.Arbitrary<SamplePoint> = fc.record({
  lat: fc.double({ min: 42.0, max: 42.6, noNaN: true, noDefaultInfinity: true }),
  lon: fc.double({ min: -70.9, max: -70.3, noNaN: true, noDefaultInfinity: true }),
  // Reference distance from the shared grid center (not used by the physics,
  // which recomputes per-site distances). Kept within the sampling disc.
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

/** A small shared grid; a handful of points is enough per the note above. */
const sharedGridArb: fc.Arbitrary<SamplePoint[]> = fc.array(samplePointArb, {
  minLength: 1,
  maxLength: 12,
});

describe('cumulative superposition properties', () => {
  // Property P8 — superposition. Validates: Requirements 10.8
  // WHEN several sites are combined, the cumulative excess at every point is ≥
  // the largest individual site's excess at that point. Each site contributes a
  // non-negative excess (P2), so summing them can only grow the value past the
  // single largest contributor. Checked against the RAW summed excess
  // (impact.excessC), which is what the shallow-water derivation keys off.
  it('P8 (R10.8): cumulative excess ≥ max individual excess at every point', () => {
    fc.assert(
      fc.property(
        fc.array(siteArb, { minLength: 1, maxLength: 4 }),
        sharedGridArb,
        (sites, grid) => {
          const combined = cumulativeImpacts(sites, grid);
          const maxEach = maxIndividualExcessC(sites, grid);

          expect(combined.length).toBe(grid.length);
          expect(maxEach.length).toBe(grid.length);

          for (let k = 0; k < grid.length; k++) {
            // Tiny tolerance for floating-point summation order.
            expect(combined[k].excessC).toBeGreaterThanOrEqual(maxEach[k] - 1e-9);
          }
        },
      ),
    );
  });

  // Sanity — a single site's cumulative field equals that site's own impacts on
  // the shared grid. With one contributor there is nothing to superpose, so the
  // combined excess/bottom/combined/flag must match projectSiteOntoGrid exactly.
  it('cumulative of a single site equals that site projected onto the grid', () => {
    fc.assert(
      fc.property(siteArb, sharedGridArb, (site, grid) => {
        const combined = cumulativeImpacts([site], grid);
        const single = projectSiteOntoGrid(site, grid);

        expect(combined.length).toBe(single.length);
        for (let k = 0; k < grid.length; k++) {
          expect(combined[k].excessC).toBe(single[k].excessC);
          expect(combined[k].bottomExcessC).toBe(single[k].bottomExcessC);
          expect(combined[k].combinedC).toBe(single[k].combinedC);
          expect(combined[k].deepSurfaceOnly).toBe(single[k].deepSurfaceOnly);
        }
      }),
    );
  });

  // Sanity — projecting a site onto a grid centered on its OWN outfall matches
  // the plain single-site `impacts`, because the re-aimed distances equal the
  // grid's native distances. This ties cumulative mode back to the vetted
  // single-site path.
  it('projectSiteOntoGrid matches impacts() when the grid is the site grid', () => {
    fc.assert(
      fc.property(siteArb, sharedGridArb, (site, grid) => {
        // Rebuild the grid so each point's distanceM is measured from this
        // site's outfall — the invariant samplePoints guarantees for a real grid.
        const nativeGrid: SamplePoint[] = grid.map((p) => ({
          ...p,
          distanceM: haversineM(site.outfall.lat, site.outfall.lon, p.lat, p.lon),
        }));
        const projected = projectSiteOntoGrid(site, nativeGrid);
        const direct = impacts(nativeGrid, site.thermal);

        for (let k = 0; k < grid.length; k++) {
          expect(projected[k].excessC).toBe(direct[k].excessC);
          expect(projected[k].combinedC).toBe(direct[k].combinedC);
        }
      }),
    );
  });

  // Sanity — the empty site set produces zero excess everywhere (no discharge),
  // with combinedC falling back to the baseline and nothing flagged deep.
  it('empty site set yields zero excess over the grid', () => {
    fc.assert(
      fc.property(sharedGridArb, (grid) => {
        const combined = cumulativeImpacts([], grid);
        expect(combined.length).toBe(grid.length);
        for (let k = 0; k < grid.length; k++) {
          expect(combined[k].excessC).toBe(0);
          expect(combined[k].bottomExcessC).toBe(0);
          expect(combined[k].combinedC).toBe(grid[k].baselineC);
          expect(combined[k].deepSurfaceOnly).toBe(false);
        }
      }),
    );
  });

  // Sanity — empty grid yields empty output regardless of sites.
  it('empty grid yields empty cumulative output', () => {
    fc.assert(
      fc.property(fc.array(siteArb, { maxLength: 3 }), (sites) => {
        expect(cumulativeImpacts(sites, [])).toEqual([]);
        expect(maxIndividualExcessC(sites, [])).toEqual([]);
      }),
    );
  });

  // Spot check — excessAt is consistent with maxIndividualExcessC so the P8
  // comparison is apples-to-apples (both measure distance from each site's own
  // outfall).
  it('maxIndividualExcessC equals the per-point max of excessAt from each outfall', () => {
    fc.assert(
      fc.property(
        fc.array(siteArb, { minLength: 1, maxLength: 3 }),
        sharedGridArb,
        (sites, grid) => {
          const maxEach = maxIndividualExcessC(sites, grid);
          grid.forEach((p, k) => {
            let expected = 0;
            for (const s of sites) {
              const e = excessAt(
                haversineM(s.outfall.lat, s.outfall.lon, p.lat, p.lon),
                s.thermal,
              );
              if (e > expected) expected = e;
            }
            expect(maxEach[k]).toBe(expected);
          });
        },
      ),
    );
  });
});
