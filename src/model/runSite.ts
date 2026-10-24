// src/model/runSite.ts — Task 3.3 (design.md, .kiro/steering/thermal-model.md v2.1).
// Pure, deterministic, no I/O. The ONLY model entry point the UI calls.
//
// Satisfies:
//   R3.2 — an outfall inside the land mask throws OutfallOnLandError
//          (the UI uses this to show a friendly message and prevent the click).
//   R6.1 — per-species area-based score and level (via speciesRisk).
//   R6.2 — coverage and the "Insufficient data" level (via coverage/speciesRisk).

import type { FeatureCollection } from 'geojson';

import { isOutfallOnLand, samplePoints, type LatLon } from './grid';
import { impacts } from './plume';
import { coverage, plumeAreaKm2, speciesRisk } from './risk';
import { computeThermal } from './thermal';
import {
  OutfallOnLandError,
  type BaselineCell,
  type SiteInputs,
  type SiteResult,
  type Species,
} from './types';

/**
 * Run the full thermal screening for one site and return everything the UI
 * renders. This is the single composition point over the pure model modules:
 *
 *   1. Reject an outfall inside the land mask (R3.2 → OutfallOnLandError).
 *   2. computeThermal(inputs) — validates input bounds (may throw
 *      InputRangeError) and derives heat, flow, mixing, decay length, reach.
 *   3. samplePoints(outfall, cells, land) — the 250 m water grid with each
 *      point's containing baseline cell temperature and depth.
 *   4. impacts(points, thermal) — per-point excess with the negligible- and
 *      shallow-water rules applied.
 *   5. plumeAreaKm2, coverage, and one SpeciesRisk per species.
 *
 * Pure and deterministic: the result depends only on the inputs. No I/O; the
 * caller loads cells, species, and land from `/public/data`.
 *
 * @param inputs Site inputs (location + bounded facility parameters).
 * @param cells Baseline FIShBOT cells (may be empty).
 * @param species Species whose thermal thresholds are evaluated (may be empty).
 * @param land Land-mask polygons as a GeoJSON FeatureCollection (may be empty).
 * @returns A {@link SiteResult} matching `types.ts` exactly.
 * @throws {OutfallOnLandError} when the outfall lies inside the land mask.
 * @throws {InputRangeError} when a bounded input is out of range (from
 *   computeThermal).
 */
export function runSite(
  inputs: SiteInputs,
  cells: BaselineCell[],
  species: Species[],
  land: FeatureCollection | null | undefined,
): SiteResult {
  const outfall: LatLon = { lat: inputs.lat, lon: inputs.lon };

  // R3.2 — reject an on-land outfall before any further work.
  if (isOutfallOnLand(outfall, land)) {
    throw new OutfallOnLandError(
      `Outfall at (${inputs.lat}, ${inputs.lon}) is on land; place it in water.`,
    );
  }

  // Validates bounds (may throw InputRangeError) and derives thermal geometry.
  const thermal = computeThermal(inputs);

  // Water sample grid, then per-point excess/impact.
  const samples = samplePoints(outfall, cells, land);
  const points = impacts(samples, thermal);

  return {
    inputs,
    thermal,
    points,
    plumeAreaKm2: plumeAreaKm2(points),
    coverage: coverage(points),
    risks: species.map((s) => speciesRisk(points, s)),
  };
}
