/**
 * Area accounting and per-species scoring. Pure, no I/O.
 * See thermal-model.md "Areas" and "Site score".
 */
import { AREA_SCALE_KM2 } from './constants';
import type { SpeciesResult } from './types';

/** Screening score 0–100 from newly exceeded area (km²). */
export function scoreFromArea(newlyExceededKm2: number): number {
  return 100 * (1 - Math.exp(-newlyExceededKm2 / AREA_SCALE_KM2));
}

/** Map a score to a qualitative level (ignores the coverage override). */
export function levelFromScore(score: number): Exclude<SpeciesResult['level'], 'Insufficient data'> {
  if (score > 30) return 'High';
  if (score >= 10) return 'Medium';
  return 'Low';
}
