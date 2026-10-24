// src/model/maxSafe.ts — Task 11.1 (design.md, .kiro/steering/thermal-model.md v2.2).
// Pure, deterministic, no I/O. SI units internally; numeric names carry unit suffixes.
//
// Satisfies:
//   R11.1 — the largest integer facilityMW (1–500) at which EVERY selected
//           species scores Low, for the site's FIXED deltaTC/mixRatio/
//           heatFraction and the selected species (the UI renders "N MW").
//   R11.2 — null when even 1 MW is not Low ("No size is Low impact at this site").
//   R11.3 — 500 when the whole range is Low (the UI renders "500+ MW").
//   R11.4 — coverage is reported at the result so the UI can substitute the
//           "Insufficient data" label when coverage < MIN_COVERAGE.
//
// Exercised by R10.20 (P17, max-safe correctness) and R10.21 (P18, null case /
// facilityMW independence); those property tests are task 11.2.

import type { FeatureCollection } from 'geojson';

import { BOUNDS } from './constants';
import { isOutfallOnLand, samplePoints, type LatLon } from './grid';
import { impacts } from './plume';
import { coverage, speciesRisk } from './risk';
import { computeThermal } from './thermal';
import {
  OutfallOnLandError,
  type BaselineCell,
  type PointImpact,
  type SiteInputs,
  type Species,
} from './types';

/** Integer facility-size search bounds (MW), single-sourced from BOUNDS. */
const MIN_MW = BOUNDS.facilityMW.min;
const MAX_MW = BOUNDS.facilityMW.max;

/** Result of the largest-safe-size search (design.md model table). */
export interface MaxSafeResult {
  /**
   * Largest INTEGER facilityMW in [MIN_MW, MAX_MW] at which every selected
   * species scores Low, or null when even MIN_MW is not Low. MAX_MW means the
   * whole range is Low (the UI renders it as "500+ MW").
   */
  maxMW: number | null;
  /**
   * Plume data coverage at the reported MW (at the largest safe size, or at
   * MIN_MW for the null case). The UI applies the MIN_COVERAGE "Insufficient
   * data" label (R11.4); this value is returned as-is.
   */
  coverage: number;
}

/**
 * Find the largest data-center size a site can host while every selected
 * species stays at Low impact.
 *
 * For the site's FIXED temperature rise, mixing ratio, and heat fraction (taken
 * from `inputs`), this searches the largest INTEGER facilityMW in
 * [MIN_MW, MAX_MW] for which EVERY selected species scores Low (score < 10, via
 * `speciesRisk().level === 'Low'`). The incoming `inputs.facilityMW` is ignored
 * — the search always spans the full range (R10.21 / P18).
 *
 * "Selected species" are the entries of `species` whose id appears in
 * `speciesIds`. With no selected species there is no Low-impact constraint, so
 * every size is vacuously safe and the result is MAX_MW (reported with the
 * site's coverage at MAX_MW).
 *
 * Performance: the fine sampling grid (and its land mask / point-in-polygon
 * work) is built EXACTLY ONCE via `samplePoints`; each candidate size only
 * recomputes `computeThermal` + `impacts` + `speciesRisk` over those reused
 * points. Binary search keeps this to ~log2(500) ≈ 9 evaluations plus the
 * boundary check (thermal-model.md: "At most ~10 runSite calls per site; reuse
 * the site's sample points").
 *
 * Monotonicity (property 9: each species score is non-decreasing in facilityMW,
 * all else equal) makes the binary search valid: safe sizes form a prefix
 * [MIN_MW, n] of the range.
 *
 * Pure and deterministic; no I/O (the caller loads cells, species, and land).
 *
 * @param inputs Site inputs; only lat/lon and the fixed deltaTC/mixRatio/
 *   heatFraction are used. `inputs.facilityMW` does not affect the result.
 * @param cells Baseline FIShBOT cells (may be empty).
 * @param species Species whose thermal thresholds may be evaluated (may be empty).
 * @param land Land-mask polygons as a GeoJSON FeatureCollection (may be empty).
 * @param speciesIds Ids of the SELECTED species to require Low. Empty means no
 *   constraint.
 * @returns A {@link MaxSafeResult} with the largest safe size (or null) and the
 *   coverage at the reported size.
 * @throws {OutfallOnLandError} when the outfall lies inside the land mask
 *   (mirrors runSite).
 * @throws {InputRangeError} when a fixed bounded input is out of range (from
 *   computeThermal).
 */
export function maxSafeMW(
  inputs: SiteInputs,
  cells: BaselineCell[],
  species: Species[],
  land: FeatureCollection | null | undefined,
  speciesIds: string[],
): MaxSafeResult {
  const outfall: LatLon = { lat: inputs.lat, lon: inputs.lon };

  // Mirror runSite: reject an on-land outfall before any further work (R3.2).
  if (isOutfallOnLand(outfall, land)) {
    throw new OutfallOnLandError(
      `Outfall at (${inputs.lat}, ${inputs.lon}) is on land; place it in water.`,
    );
  }

  // Build the fine sampling grid ONCE. The land mask / point-in-polygon work is
  // paid here and reused for every candidate size; candidates only vary the
  // thermal field over these same points.
  const samples = samplePoints(outfall, cells, land);

  // Resolve the selected species. Order-independent; a species id not present
  // in `species` contributes no constraint. With none selected there is no
  // Low-impact constraint at all.
  const selectedIds = new Set(speciesIds);
  const selected = species.filter((s) => selectedIds.has(s.id));

  /** Point impacts over the reused samples at a given candidate size (MW). */
  const impactsAtMW = (mw: number): PointImpact[] => {
    const thermal = computeThermal({ ...inputs, facilityMW: mw });
    return impacts(samples, thermal);
  };

  /**
   * True iff EVERY selected species scores Low at `mw`. Reuses speciesRisk so
   * the Low boundary stays single-sourced (score < 10 ⇔ level === 'Low').
   * Vacuously true when no species are selected.
   */
  const isLowAtMW = (mw: number): boolean => {
    const points = impactsAtMW(mw);
    return selected.every((s) => speciesRisk(points, s).level === 'Low');
  };

  // Null case (R11.2): if even the smallest size is not Low, no size is Low.
  // Report coverage at MIN_MW for a consistent geometry-based figure.
  if (!isLowAtMW(MIN_MW)) {
    return { maxMW: null, coverage: coverage(impactsAtMW(MIN_MW)) };
  }

  // Whole range is Low (R11.3): report MAX_MW (UI shows "500+ MW").
  if (isLowAtMW(MAX_MW)) {
    return { maxMW: MAX_MW, coverage: coverage(impactsAtMW(MAX_MW)) };
  }

  // Binary search for the largest integer n in (MIN_MW, MAX_MW) with
  // isLowAtMW(n) true. Invariant: isLowAtMW(lo) is true, isLowAtMW(hi) is false.
  // Monotonicity (P9) guarantees the safe sizes are the prefix [MIN_MW, lo].
  let lo = MIN_MW;
  let hi = MAX_MW;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (isLowAtMW(mid)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  // lo is the largest safe integer size; lo + 1 (= hi) is not safe.
  return { maxMW: lo, coverage: coverage(impactsAtMW(lo)) };
}
