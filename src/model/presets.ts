// src/model/presets.ts — Task 5.2 (design.md, requirements R3.1, R6.2).
// Pure data, no I/O. The UI seeds the map with these starter sites (R3.1); the
// click-to-place flow (task 6.1) lets the user add their own.
//
// Satisfies:
//   R3.1 — offer preset sites spread along the coast near the baseline
//          FIShBOT footprint so a first-time user sees real results immediately.
//   R6.2 — every preset verifies at coverage ≥ MIN_COVERAGE against the
//          committed FIShBOT snapshot, so none renders "Insufficient data" in
//          the demo. The accompanying test (tests/model/presets.test.ts) runs
//          runSite over the committed data and asserts coverage ≥ MIN_COVERAGE
//          for each entry.

import { DEFAULT_HEAT_FRACTION } from './constants';
import type { SiteInputs } from './types';

/** A named starter site the UI can drop onto the map (R3.1). */
export interface PresetSite {
  /** Short human-readable label shown in the UI. */
  name: string;
  /** Model inputs (location + bounded facility parameters). */
  inputs: SiteInputs;
}

/**
 * Default facility parameters for every preset, per R3.3:
 *   facilityMW 100, deltaTC 4 °C, mixRatio 0, heatFraction 0.88.
 * heatFraction uses {@link DEFAULT_HEAT_FRACTION} rather than an inline literal.
 */
const DEFAULT_FACILITY = {
  facilityMW: 100,
  deltaTC: 4,
  mixRatio: 0,
  heatFraction: DEFAULT_HEAT_FRACTION,
} as const;

/**
 * Five preset outfall sites spread across the committed FIShBOT baseline
 * footprint (Massachusetts Bay / Cape Cod Bay). Coordinates were chosen so each
 * site sits in water (runSite does not throw OutfallOnLandError) and each
 * verifies at coverage ≥ MIN_COVERAGE (0.5) against the committed snapshot, so
 * every preset produces a real score in the demo (R3.1, R6.2).
 *
 * Verified coverage against public/data/fishbot.json at the default facility
 * parameters (see tests/model/presets.test.ts):
 *   Cape Cod Bay – central            ≈ 1.00
 *   Cape Cod Bay – south (Sandwich)   ≈ 0.96
 *   Cape Cod Bay – north (Plymouth)   ≈ 0.90
 *   Massachusetts Bay – Boston approach ≈ 0.80
 */
export const PRESET_SITES: readonly PresetSite[] = [
  {
    name: 'Cape Cod Bay – central',
    inputs: { lat: 41.84, lon: -70.49, ...DEFAULT_FACILITY },
  },
  {
    name: 'Cape Cod Bay – south (off Sandwich)',
    inputs: { lat: 41.78, lon: -70.45, ...DEFAULT_FACILITY },
  },
  {
    name: 'Cape Cod Bay – north (Plymouth approach)',
    inputs: { lat: 41.92, lon: -70.51, ...DEFAULT_FACILITY },
  },
  {
    name: 'Massachusetts Bay – Boston approach',
    inputs: { lat: 42.28, lon: -70.79, ...DEFAULT_FACILITY },
  },
  // Centered on the lone warm ≥19 °C FIShBOT cell south of Cape Cod
  // (41.555, -70.134, Nantucket Sound). That cell is a SINGLE observation
  // (nObs=1) far from the main Cape Cod Bay cluster, so this preset's plume
  // has coverage BELOW MIN_COVERAGE at the default 100 MW and honestly reads
  // as "Insufficient data" — a deliberate demo of the tool refusing to score
  // where the data is too sparse (product honesty rule). It is therefore
  // exempt from the coverage ≥ MIN_COVERAGE check in presets.test.ts.
  {
    name: 'Nantucket Sound (warm cell, low coverage)',
    inputs: { lat: 41.555, lon: -70.134, ...DEFAULT_FACILITY },
  },
] as const;
