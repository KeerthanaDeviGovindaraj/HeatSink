// src/model/plume.ts — Task 3.2 (design.md, .kiro/steering/thermal-model.md v2.1).
// Pure, deterministic, no I/O. SI units internally; numeric names carry unit suffixes.
//
// Satisfies:
//   R4.2 — excess below NEGLIGIBLE_C is zeroed before any threshold test
//          (the negligible rule runs FIRST, ahead of the shallow-water rule).
//   R4.3 — shallow-water rule: discharge reaches the bottom only in water
//          ≤ SHALLOW_DEPTH_M; deeper points are flagged "surface only"
//          (deepSurfaceOnly = true), null-depth points are treated as shallow
//          (conservative) and surfaced by the UI as "depth unknown".
//   R8   — stretch cumulative mode: excess from multiple sites adds linearly at
//          each sample point (superposition), then impacts are re-derived.

import { NEGLIGIBLE_C, SHALLOW_DEPTH_M } from './constants';
import type { PointImpact, SamplePoint, ThermalResult } from './types';

/**
 * Screening excess temperature (°C) at distance `r` (m) from the outfall.
 *
 * `excessC(r) = deltaTEffC * exp(-r / decayLengthM)` per thermal-model.md
 * "Screening plume". Monotonically non-increasing in r and equal to
 * `deltaTEffC` at r = 0.
 *
 * @param rM Distance from the outfall in meters (≥ 0 for physical points).
 * @param thermal Thermal result providing `deltaTEffC` and `decayLengthM`.
 * @returns Excess temperature in °C (≥ 0 for r ≥ 0).
 */
export function excessAt(rM: number, thermal: ThermalResult): number {
  return thermal.deltaTEffC * Math.exp(-rM / thermal.decayLengthM);
}

/**
 * Apply the negligible-then-shallow rules to a raw excess at a point of a given
 * depth, yielding the bottom excess and the deep-surface-only flag.
 *
 * Order matters (thermal-model.md "Bottom effect"):
 *   1. Negligible rule FIRST: if `excessC < NEGLIGIBLE_C` the bottom sees
 *      nothing (bottomExcessC = 0) and the point is NOT flagged deep — no
 *      further tests run.
 *   2. Otherwise the shallow-water rule: the bottom feels the full excess when
 *      depth is null (treated as shallow, conservative) or depth ≤
 *      SHALLOW_DEPTH_M; in deeper water the bottom excess is 0 and the point is
 *      flagged `deepSurfaceOnly = true`.
 */
function deriveBottom(
  excessC: number,
  depthM: number | null,
): { bottomExcessC: number; deepSurfaceOnly: boolean } {
  // 1. Negligible rule first — no shallow/deep classification below the floor.
  if (excessC < NEGLIGIBLE_C) {
    return { bottomExcessC: 0, deepSurfaceOnly: false };
  }
  // 2. Shallow-water rule. Null depth is conservatively treated as shallow.
  const isShallow = depthM === null || depthM <= SHALLOW_DEPTH_M;
  if (isShallow) {
    return { bottomExcessC: excessC, deepSurfaceOnly: false };
  }
  return { bottomExcessC: 0, deepSurfaceOnly: true };
}

/**
 * Build a {@link PointImpact} from a sample point and a raw excess temperature.
 *
 * `combinedC = baselineC + bottomExcessC` when the point has baseline data;
 * otherwise null ("no data"). `excessC` stores the raw excess, while
 * `bottomExcessC` is governed by the negligible-then-shallow rules.
 */
function toImpact(point: SamplePoint, excessC: number): PointImpact {
  const { bottomExcessC, deepSurfaceOnly } = deriveBottom(excessC, point.depthM);
  const combinedC =
    point.baselineC === null ? null : point.baselineC + bottomExcessC;
  return {
    ...point,
    excessC,
    bottomExcessC,
    combinedC,
    deepSurfaceOnly,
  };
}

/**
 * Map every sample point to a {@link PointImpact} for a single discharge.
 *
 * For each point the raw excess is `excessAt(point.distanceM, thermal)`; the
 * negligible rule is applied before the shallow-water rule (R4.2, R4.3). Pure:
 * the output depends only on the inputs and preserves input order.
 *
 * @param points Water sample points from {@link samplePoints}.
 * @param thermal Thermal result for the discharge.
 * @returns One impact per input point, in the same order.
 */
export function impacts(
  points: SamplePoint[],
  thermal: ThermalResult,
): PointImpact[] {
  return points.map((point) => toImpact(point, excessAt(point.distanceM, thermal)));
}

/**
 * Cumulative superposition across multiple sites (R8, stretch).
 *
 * Takes an array of per-site {@link PointImpact} lists that are ALIGNED
 * POINT-FOR-POINT BY INDEX: entry `k` of every inner list must describe the
 * same physical sample point (same lat/lon/distance/baseline/depth). Callers
 * guarantee this by running {@link impacts} over the same sample grid for every
 * site. The returned list has the length of the longest input list.
 *
 * At each index the raw excesses add linearly (`excessTotal = Σ excessC_i`,
 * thermal-model.md "Cumulative mode"), then the bottom excess, combined
 * temperature, and deep-surface-only flag are re-derived from the summed excess
 * using the same negligible-then-shallow rules. Point geometry (lat, lon,
 * distanceM, baselineC, depthM) is taken from the first list that has an entry
 * at that index.
 *
 * Pure and deterministic. An empty input yields an empty list.
 *
 * @param list One {@link PointImpact} array per site, index-aligned.
 * @returns The combined impacts, one per aligned sample point.
 */
export function sumImpacts(list: PointImpact[][]): PointImpact[] {
  if (list.length === 0) return [];

  const maxLen = list.reduce((max, site) => Math.max(max, site.length), 0);

  const combined: PointImpact[] = [];
  for (let k = 0; k < maxLen; k++) {
    // Base geometry from the first site that has this index.
    let base: SamplePoint | null = null;
    let excessTotal = 0;
    for (const site of list) {
      const impact = site[k];
      if (impact === undefined) continue;
      if (base === null) base = impact;
      excessTotal += impact.excessC;
    }
    // base is non-null because k < maxLen implies at least one site has entry k.
    combined.push(toImpact(base as SamplePoint, excessTotal));
  }
  return combined;
}
