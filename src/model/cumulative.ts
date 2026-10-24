// src/model/cumulative.ts — Task 9.1 (stretch; design.md, requirements.md R8/R10.8,
// .kiro/steering/thermal-model.md v2.1 "Cumulative mode").
// Pure, deterministic, no I/O. SI units internally; numeric names carry unit suffixes.
//
// Satisfies:
//   R8    — cumulative mode: sum excess from all saved sites at each sample
//           point (superposition) so species areas can be recomputed over the
//           combined field.
//   R10.8 — Property P8: cumulative excess ≥ the largest individual excess at
//           every point.
//
// --------------------------------------------------------------------------
// Design decision — why this file exists and does NOT misuse sumImpacts
// --------------------------------------------------------------------------
// plume.ts `sumImpacts(list)` sums raw excess INDEX-FOR-INDEX across a list of
// per-site PointImpact arrays and re-derives each combined impact with the
// negligible-then-shallow rules. It is only correct when every inner array
// describes the SAME physical sample point at the same index — i.e. every site
// was sampled on ONE shared grid.
//
// In the app, saved sites can have DIFFERENT outfalls, so runSite built each
// one on ITS OWN grid (samplePoints is centered on that site's outfall). Those
// native grids are NOT index-aligned: index k of site A and index k of site B
// are different lat/lon, so feeding the sites' native `result.points` straight
// into sumImpacts would sum unrelated points — wrong, and it could even violate
// P8.
//
// The correct superposition over the UNION of sites is to pick ONE shared
// sample grid and, for each shared point, evaluate every site's excess AT THAT
// POINT (excessAt of the haversine distance from that site's own outfall) and
// sum. This module does exactly that:
//
//   1. For each site, project its excess onto the shared grid, producing a
//      PointImpact array that is aligned to the shared grid by construction
//      (same points, in the same order, only excessC differs per site).
//   2. Hand those now-aligned arrays to the existing, vetted `sumImpacts`,
//      which sums the raw excess and re-derives bottomExcessC / combinedC /
//      deepSurfaceOnly with the same rules the single-site path uses.
//
// This keeps one source of truth for the negligible-then-shallow derivation and
// makes P8 hold on a real combined field. The CALLER chooses the shared grid
// (see App: the focused outfall's grid), which is documented there.

import { haversineM, type LatLon } from './grid';
import { excessAt, impacts, sumImpacts } from './plume';
import { coverage, plumeAreaKm2, speciesRisk } from './risk';
import type {
  PointImpact,
  SamplePoint,
  Species,
  SpeciesRisk,
  ThermalResult,
} from './types';

/** One discharge participating in the cumulative field: where it is + its thermal result. */
export interface CumulativeSite {
  /** The site's outfall location (its own grid center). */
  outfall: LatLon;
  /** The site's thermal result (deltaTEffC, decayLengthM, …). */
  thermal: ThermalResult;
}

/**
 * Project one site's screening excess onto a SHARED sample grid.
 *
 * Returns a {@link PointImpact} array aligned index-for-index to `points`: each
 * entry keeps the shared point's geometry (lat, lon, distanceM, baselineC,
 * depthM) but its `excessC` is the site's excess at that point, i.e.
 * `excessAt(haversineM(site.outfall, point), site.thermal)` — the distance is
 * measured from THIS site's outfall, not from whatever the point's own
 * `distanceM` was. The negligible-then-shallow rules are applied by `impacts`
 * exactly as in the single-site path. Pure.
 *
 * @param site The discharge to project.
 * @param points The shared sample grid (same for every site).
 * @returns One impact per shared point, in input order.
 */
export function projectSiteOntoGrid(
  site: CumulativeSite,
  points: SamplePoint[],
): PointImpact[] {
  // Re-point each sample at this site's outfall so excess decays from the right
  // center, then run the standard impacts() derivation. Geometry is preserved;
  // only distanceM (used by impacts via excessAt) is replaced.
  const reaimed: SamplePoint[] = points.map((p) => ({
    ...p,
    distanceM: haversineM(site.outfall.lat, site.outfall.lon, p.lat, p.lon),
  }));
  return impacts(reaimed, site.thermal);
}

/**
 * Cumulative superposition across several sites on ONE shared sample grid (R8).
 *
 * For every shared sample point the raw excesses of all sites add linearly
 * (`excessTotal = Σ excessAt(dist_i, thermal_i)`, thermal-model.md "Cumulative
 * mode"); the combined bottom excess, combined temperature and
 * deep-surface-only flag are then re-derived from that sum with the
 * negligible-then-shallow rules. Implemented by projecting each site onto the
 * shared grid (so the arrays are index-aligned by construction) and delegating
 * the summation + re-derivation to the vetted {@link sumImpacts}.
 *
 * Point geometry (lat, lon, distanceM, baselineC, depthM) comes from the shared
 * grid; `distanceM` on the output is the shared grid's own distanceM (distance
 * from the grid center), which cumulative-mode callers treat as reference only
 * — the physics used the per-site distances internally.
 *
 * Edge cases: an empty site list yields zero-excess impacts over the shared
 * grid (no discharge anywhere); an empty grid yields an empty list. Pure and
 * deterministic.
 *
 * @param sites The discharges to combine (each with its own outfall + thermal).
 * @param points The shared sample grid every site is evaluated on.
 * @returns One combined {@link PointImpact} per shared point, in input order.
 */
export function cumulativeImpacts(
  sites: CumulativeSite[],
  points: SamplePoint[],
): PointImpact[] {
  if (sites.length === 0) {
    // No discharge: zero excess everywhere, but still a well-formed impact per
    // point (combinedC = baselineC, nothing flagged) so downstream area/coverage
    // math is defined. Reuse impacts() with a zeroed thermal via excessAt = 0.
    return points.map((p) => {
      const zero: PointImpact = {
        ...p,
        excessC: 0,
        bottomExcessC: 0,
        combinedC: p.baselineC,
        deepSurfaceOnly: false,
      };
      return zero;
    });
  }

  const projected = sites.map((site) => projectSiteOntoGrid(site, points));
  return sumImpacts(projected);
}

/**
 * The largest single-site excess at each shared point (used by the P8 test and
 * handy for diagnostics). `max_i excessAt(dist_i, thermal_i)` with a floor of 0
 * for the empty-site / empty-grid cases. Pure.
 *
 * @param sites The discharges considered.
 * @param points The shared sample grid.
 * @returns One max-individual-excess value (°C, ≥ 0) per shared point.
 */
export function maxIndividualExcessC(
  sites: CumulativeSite[],
  points: SamplePoint[],
): number[] {
  return points.map((p) => {
    let max = 0;
    for (const site of sites) {
      const e = excessAt(
        haversineM(site.outfall.lat, site.outfall.lon, p.lat, p.lon),
        site.thermal,
      );
      if (e > max) max = e;
    }
    return max;
  });
}

/**
 * The cumulative-mode screening summary over a set of combined sites (R8).
 *
 * Mirrors the site-level quantities of a {@link SiteResult} but for the
 * SUPERPOSED field: `points` are the combined impacts, and `plumeAreaKm2`,
 * `coverage`, and per-species `risks` are the SAME functions the single-site
 * path uses (risk.ts), so cumulative numbers are consistent with the rest of
 * the app. `siteCount` is how many sites were combined (0 ⇒ nothing to show).
 */
export interface CumulativeResult {
  siteCount: number;
  points: PointImpact[];
  plumeAreaKm2: number;
  coverage: number;
  risks: SpeciesRisk[];
}

/**
 * Compute the cumulative-mode result for a set of sites on one shared grid.
 *
 * Builds the combined impacts with {@link cumulativeImpacts}, then reuses
 * {@link plumeAreaKm2}, {@link coverage}, and {@link speciesRisk} so the plume
 * area, coverage, and per-species newly/already-exceeded areas are computed
 * exactly as for a single site — just over the superposed field (R8). Pure.
 *
 * @param sites The discharges to combine (each with its own outfall + thermal).
 * @param points The shared sample grid (see App for how it is chosen).
 * @param species Species whose thresholds are evaluated over the combined field.
 * @returns The {@link CumulativeResult} the UI renders.
 */
export function cumulativeResult(
  sites: CumulativeSite[],
  points: SamplePoint[],
  species: Species[],
): CumulativeResult {
  const combined = cumulativeImpacts(sites, points);
  return {
    siteCount: sites.length,
    points: combined,
    plumeAreaKm2: plumeAreaKm2(combined),
    coverage: coverage(combined),
    risks: species.map((s) => speciesRisk(combined, s)),
  };
}
