/**
 * Pure exceedance classification for the species overlay (R5.4).
 *
 * Given one {@link PointImpact} and a species threshold T* (°C), decide whether
 * the discharge leaves that point:
 *   - 'already'  — the baseline is already at/above T* (warm before the plume);
 *   - 'newly'    — the baseline is below T* but the combined temperature reaches
 *                  T* (the discharge pushes it past the threshold);
 *   - 'none'     — neither (no baseline data, or combined stays below T*).
 *
 * The rule mirrors `speciesRisk` in src/model/risk.ts exactly so the MapView
 * overlay and the scored areas agree on what counts as newly vs already
 * exceeded. Keeping it pure (no React, no Leaflet) lets the node-env vitest
 * suite exercise it directly. R5.4 is about styling a SELECTED species, so the
 * caller decides which threshold to pass; this helper is per-point and
 * threshold-agnostic.
 */
import type { PointImpact } from '../model/types';

/** How a sample point relates to a species threshold. */
export type Exceedance = 'newly' | 'already' | 'none';

/**
 * Classify one point against a species threshold.
 *
 * Matches `speciesRisk` (risk.ts):
 *   - ALREADY: `baselineC != null && baselineC >= thresholdC`.
 *   - NEWLY:   `baselineC != null && baselineC < thresholdC &&
 *               combinedC != null && combinedC >= thresholdC`.
 *   - NONE:    anything else (null baseline, or combined below the threshold).
 *
 * A point is never both newly and already exceeded: the `already` test consumes
 * every point whose baseline is at/above the threshold before the `newly` test
 * is reached, so the two outcomes are mutually exclusive.
 *
 * @param point The per-point impact (baseline + combined temperatures).
 * @param thresholdC The selected species threshold T* in °C.
 * @returns 'newly', 'already', or 'none'.
 */
export function classifyPoint(
  point: Pick<PointImpact, 'baselineC' | 'combinedC'>,
  thresholdC: number,
): Exceedance {
  const { baselineC, combinedC } = point;
  if (baselineC === null) return 'none';
  if (baselineC >= thresholdC) return 'already';
  if (combinedC !== null && combinedC >= thresholdC) return 'newly';
  return 'none';
}
