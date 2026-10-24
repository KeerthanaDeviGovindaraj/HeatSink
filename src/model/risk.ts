// src/model/risk.ts — Task 3.3 (design.md, .kiro/steering/thermal-model.md v2.1).
// Pure, deterministic, no I/O. SI units internally; numeric names carry unit suffixes.
//
// Satisfies:
//   R6.1 — per-species site score from newly exceeded AREA, with Low/Medium/High
//          levels (area-based score fixes the v1 monotonicity/divide-by-zero bug).
//   R6.2 — coverage over plume points and the "Insufficient data" level when
//          coverage falls below MIN_COVERAGE.

import {
  AREA_SCALE_KM2,
  MIN_COVERAGE,
  NEGLIGIBLE_C,
  POINT_AREA_KM2,
} from './constants';
import type { Level, PointImpact, Species, SpeciesRisk } from './types';

/**
 * Km² represented by a single fine-grid sample point. Derived from the shared
 * {@link POINT_AREA_KM2} constant (= (SAMPLE_SPACING_M / 1000)²); never inline.
 */
const AREA_PER_POINT_KM2 = POINT_AREA_KM2;

/**
 * Level boundaries for the site score (thermal-model.md "Site score":
 * Low < 10, Medium 10–30, High > 30). Boundaries chosen so the three levels are
 * exhaustive and non-overlapping over [0, 100]:
 *   Low:    score < 10
 *   Medium: 10 ≤ score ≤ 30
 *   High:   score > 30
 */
const LEVEL_LOW_MAX = 10;
const LEVEL_MEDIUM_MAX = 30;

/** True when a point is part of the plume: its raw excess is not negligible. */
function isPlumePoint(point: PointImpact): boolean {
  return point.excessC >= NEGLIGIBLE_C;
}

/**
 * Plume area (km²) for a set of point impacts: the number of plume points
 * (excessC ≥ NEGLIGIBLE_C) times the per-point area. Site-level quantity,
 * independent of any species threshold (thermal-model.md "Areas").
 *
 * @param points Point impacts for the site (from `impacts`).
 * @returns Plume area in km² (≥ 0).
 */
export function plumeAreaKm2(points: PointImpact[]): number {
  let count = 0;
  for (const point of points) {
    if (isPlumePoint(point)) count++;
  }
  return count * AREA_PER_POINT_KM2;
}

/**
 * Data coverage over the plume: the share of plume points that have baseline
 * data. Plume points are those with excessC ≥ NEGLIGIBLE_C (water points only;
 * land points were already discarded upstream in `samplePoints`).
 *
 * Returns 1 when the plume has no points (nothing to be uncertain about), so
 * coverage is always within [0, 1] (property 14).
 *
 * @param points Point impacts for the site.
 * @returns Coverage fraction in [0, 1].
 */
export function coverage(points: PointImpact[]): number {
  let plume = 0;
  let withData = 0;
  for (const point of points) {
    if (!isPlumePoint(point)) continue;
    plume++;
    if (point.baselineC !== null) withData++;
  }
  if (plume === 0) return 1;
  return withData / plume;
}

/**
 * Classify a score into a {@link Level} using the exhaustive, non-overlapping
 * boundaries documented above. Does not apply the coverage override.
 */
function levelForScore(score: number): Exclude<Level, 'Insufficient data'> {
  if (score < LEVEL_LOW_MAX) return 'Low';
  if (score <= LEVEL_MEDIUM_MAX) return 'Medium';
  return 'High';
}

/**
 * Compute the risk to one species for a set of point impacts.
 *
 * For the species threshold T* (`species.thresholdC`), per thermal-model.md
 * "Areas" and "Site score":
 *   - NEWLY EXCEEDED point: baselineC != null AND baselineC < T* AND
 *     combinedC != null AND combinedC ≥ T* (the discharge pushes it past T*).
 *   - ALREADY EXCEEDED point: baselineC != null AND baselineC ≥ T*.
 *   - newlyExceededKm2 / alreadyExceededKm2 = count × per-point area.
 *   - score = 100 · (1 − exp(−newlyExceededKm2 / AREA_SCALE_KM2)): bounded
 *     0–100, rises with newly exceeded area, never divides by zero.
 *   - level from {@link levelForScore}, overridden to "Insufficient data" when
 *     coverage(points) < MIN_COVERAGE (score is still computed).
 *
 * Pure and deterministic; depends only on the inputs.
 *
 * @param points Point impacts for the site (from `impacts`).
 * @param species The species whose thermal threshold is evaluated.
 * @returns The {@link SpeciesRisk} for this species at this site.
 */
export function speciesRisk(
  points: PointImpact[],
  species: Species,
): SpeciesRisk {
  const thresholdC = species.thresholdC;

  let newlyCount = 0;
  let alreadyCount = 0;
  for (const point of points) {
    const { baselineC, combinedC } = point;
    if (baselineC === null) continue;
    if (baselineC >= thresholdC) {
      alreadyCount++;
    } else if (combinedC !== null && combinedC >= thresholdC) {
      newlyCount++;
    }
  }

  const newlyExceededKm2 = newlyCount * AREA_PER_POINT_KM2;
  const alreadyExceededKm2 = alreadyCount * AREA_PER_POINT_KM2;

  const score = 100 * (1 - Math.exp(-newlyExceededKm2 / AREA_SCALE_KM2));

  const level: Level =
    coverage(points) < MIN_COVERAGE
      ? 'Insufficient data'
      : levelForScore(score);

  return {
    speciesId: species.id,
    newlyExceededKm2,
    alreadyExceededKm2,
    score,
    level,
  };
}
