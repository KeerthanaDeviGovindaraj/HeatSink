import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { FeatureCollection, Feature, Polygon } from 'geojson';
import { samplePoints, isOutfallOnLand, type LatLon } from '../../src/model/grid';
import { runSite } from '../../src/model/runSite';
import type { BaselineCell, Species, SiteInputs } from '../../src/model/types';

/**
 * Property tests for the land rule (P15) from thermal-model.md v2.1 and
 * requirements.md R10.15. These are the only P2–P16 properties that must drive
 * the real ~25,900-point `samplePoints` grid (R_REF_M / SAMPLE_SPACING_M on each
 * axis), so the suite caps runs with `numRuns` and uses a small land polygon and
 * a couple of baseline cells. The grid is deterministic, so a handful of runs
 * across varied outfall locations and land boxes gives good coverage without a
 * slow property loop.
 */

/**
 * Build a rectangular land polygon (GeoJSON, lon/lat order) centered at
 * (centerLat, centerLon) with the given half-width in degrees.
 */
function landBox(
  centerLat: number,
  centerLon: number,
  halfDeg: number,
  source = 'synthetic-test-land',
): FeatureCollection {
  const minLon = centerLon - halfDeg;
  const maxLon = centerLon + halfDeg;
  const minLat = centerLat - halfDeg;
  const maxLat = centerLat + halfDeg;
  const polygon: Feature<Polygon> = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [minLon, minLat],
          [maxLon, minLat],
          [maxLon, maxLat],
          [minLon, maxLat],
          [minLon, minLat],
        ],
      ],
    },
  };
  return {
    type: 'FeatureCollection',
    // A citation-style source lives at the top level in the real mask; carry a
    // placeholder so the shape matches what loaders expect.
    ...( { source } as object ),
    features: [polygon],
  } as FeatureCollection;
}

/** A species with a mid-range threshold, used to produce a non-trivial risk. */
const SPECIES: Species[] = [
  {
    id: 'lobster',
    name: 'American lobster',
    thresholdC: 20,
    source: 'synthetic',
    verified: false,
  },
];

describe('grid land rule (P15)', () => {
  // Property P15a — no retained point lies inside the land mask.
  // Validates: Requirements 10.15
  // `samplePoints` discards every point that falls inside LAND_MASK, so none of
  // the retained water points may test as on-land for the same polygons.
  it('P15 (R10.15): no retained sample point lies inside the land mask', () => {
    const outfallArb = fc.record({
      // A water outfall offset from the land box so the outfall itself is valid.
      lat: fc.double({ min: 42.0, max: 42.5, noNaN: true, noDefaultInfinity: true }),
      lon: fc.double({ min: -70.9, max: -70.4, noNaN: true, noDefaultInfinity: true }),
    });

    fc.assert(
      fc.property(outfallArb, (outfall: LatLon) => {
        // Place a small land box ~5 km east of the outfall so it overlaps part
        // of the sampling disc without covering the outfall itself.
        const land = landBox(outfall.lat, outfall.lon + 0.06, 0.02);
        // Guard: the outfall must be in water for the scenario to be meaningful.
        fc.pre(!isOutfallOnLand(outfall, land));

        const points = samplePoints(outfall, [], land);
        for (const p of points) {
          expect(isOutfallOnLand({ lat: p.lat, lon: p.lon }, land)).toBe(false);
        }
      }),
      // The real grid is large; a few deterministic runs are sufficient.
      { numRuns: 8 },
    );
  });

  // Property P15b — mutating land-covered baselines never changes coverage or
  // any area. Validates: Requirements 10.15
  // A baseline cell whose entire ~7 km containment region sits under land can
  // only ever be attached to points that `samplePoints` discards, so its
  // temperature cannot influence coverage, plume area, or any exceeded area. We
  // run the full `runSite` with a water cell (drives the plume/areas) and a
  // fully land-buried cell, then flip the land cell's temperature across the
  // species threshold and assert every area and the coverage are byte-for-byte
  // identical.
  //
  // Geometry note: a FIShBOT cell "contains" points within ~3.5 km (half of the
  // 7 km cell) of its center, so the land box must be WIDER than that radius to
  // guarantee every point the land cell could attach to is itself dropped. The
  // box half-width (0.05° ≈ 5.5 km) comfortably exceeds the ~3.5 km radius, and
  // the land cell sits 0.12° (~13 km) east of the outfall so neither the outfall
  // nor the water cell falls inside the box.
  it('P15 (R10.15): changing land-covered baselines leaves coverage and areas unchanged', () => {
    const scenarioArb = fc.record({
      lat: fc.double({ min: 42.0, max: 42.5, noNaN: true, noDefaultInfinity: true }),
      lon: fc.double({ min: -70.9, max: -70.5, noNaN: true, noDefaultInfinity: true }),
      facilityMW: fc.double({ min: 50, max: 500, noNaN: true, noDefaultInfinity: true }),
    });

    fc.assert(
      fc.property(scenarioArb, ({ lat, lon, facilityMW }) => {
        // Land box well east of the outfall, wider than the cell's ~3.5 km
        // containment radius so the land cell is fully buried.
        const landCenterLat = lat;
        const landCenterLon = lon + 0.12;
        const land = landBox(landCenterLat, landCenterLon, 0.05);
        const outfall: LatLon = { lat, lon };
        fc.pre(!isOutfallOnLand(outfall, land));

        const inputs: SiteInputs = {
          lat,
          lon,
          facilityMW,
          deltaTC: 8,
          mixRatio: 0,
          heatFraction: 0.9,
        };

        // One water cell near the outfall (drives real areas/coverage) and one
        // cell sitting squarely inside the land box.
        const waterCell: BaselineCell = {
          id: 'water',
          lat,
          lon,
          tempC: 18,
          nObs: 10,
          depthM: 10,
        };
        const landCellWarm: BaselineCell = {
          id: 'land',
          lat: landCenterLat,
          lon: landCenterLon,
          tempC: 30, // above the 20 °C threshold
          nObs: 10,
          depthM: 10,
        };
        const landCellCold: BaselineCell = { ...landCellWarm, tempC: 5 }; // below threshold

        const resultWarm = runSite(inputs, [waterCell, landCellWarm], SPECIES, land);
        const resultCold = runSite(inputs, [waterCell, landCellCold], SPECIES, land);

        // Coverage and plume area are unaffected by the land cell's temperature.
        expect(resultCold.coverage).toBe(resultWarm.coverage);
        expect(resultCold.plumeAreaKm2).toBe(resultWarm.plumeAreaKm2);

        // Per-species areas (newly/already exceeded) are identical too.
        expect(resultCold.risks.length).toBe(resultWarm.risks.length);
        for (let i = 0; i < resultWarm.risks.length; i++) {
          expect(resultCold.risks[i].newlyExceededKm2).toBe(
            resultWarm.risks[i].newlyExceededKm2,
          );
          expect(resultCold.risks[i].alreadyExceededKm2).toBe(
            resultWarm.risks[i].alreadyExceededKm2,
          );
          expect(resultCold.risks[i].score).toBe(resultWarm.risks[i].score);
        }
      }),
      // Full-grid runSite is heavy; keep the run count small.
      { numRuns: 5 },
    );
  });
});
