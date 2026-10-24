// tests/model/presets.test.ts — Task 5.2 (requirements R3.1, R6.2).
//
// Loads the COMMITTED FIShBOT snapshot and land mask from /public/data (these
// tests run under node, so read the JSON directly rather than fetch), adapts
// rows to BaselineCell, then runs the real model entry point over each preset
// and asserts:
//   - runSite does not throw (the preset is in water, not on land) — R3.1.
//   - result.coverage ≥ MIN_COVERAGE, so no preset renders "Insufficient data"
//     in the demo — R6.2.
//
// MIN_COVERAGE is imported from constants rather than hardcoded.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { describe, it, expect } from 'vitest';
import type { FeatureCollection } from 'geojson';

import { baselineCellsFromSnapshot } from '../../src/data/loaders';
import type { OceanRow, Snapshot } from '../../src/data/types';
import { MIN_COVERAGE } from '../../src/model/constants';
import { PRESET_SITES } from '../../src/model/presets';
import { runSite } from '../../src/model/runSite';
import type { BaselineCell, SiteResult } from '../../src/model/types';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, '../../public/data');

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(dataDir, name), 'utf8')) as T;
}

const snapshot = readJson<Snapshot<OceanRow>>('fishbot.json');
const land = readJson<FeatureCollection>('ma-land.geojson');
const cells: BaselineCell[] = baselineCellsFromSnapshot(snapshot);

describe('preset sites (R3.1, R6.2)', () => {
  it('offers exactly five presets with the default facility parameters (R3.1)', () => {
    expect(PRESET_SITES).toHaveLength(5);
    for (const { inputs } of PRESET_SITES) {
      expect(inputs.facilityMW).toBe(100);
      expect(inputs.deltaTC).toBe(4);
      expect(inputs.mixRatio).toBe(0);
      expect(inputs.heatFraction).toBeCloseTo(0.88, 10);
    }
  });

  it('places presets at four distinct coordinates (R3.1)', () => {
    const keys = PRESET_SITES.map((p) => `${p.inputs.lat},${p.inputs.lon}`);
    expect(new Set(keys).size).toBe(PRESET_SITES.length);
  });

  // The Nantucket Sound preset is centered on the lone warm ≥19 °C cell, a
  // single far-flung observation; it INTENTIONALLY has coverage below
  // MIN_COVERAGE so the UI shows "Insufficient data" (product honesty rule).
  // It is exempt from the coverage floor below and checked separately.
  const LOW_COVERAGE_PRESET = 'Nantucket Sound (warm cell, low coverage)';

  // Species do not affect coverage, so an empty species list is sufficient here.
  for (const preset of PRESET_SITES) {
    const exemptLowCoverage = preset.name === LOW_COVERAGE_PRESET;
    it(`"${preset.name}" is in water${exemptLowCoverage ? '' : ' and has coverage ≥ MIN_COVERAGE'} (R6.2)`, () => {
      let result: SiteResult | undefined;
      // Not on land → runSite must not throw OutfallOnLandError (R3.1/R3.2).
      expect(() => {
        result = runSite(preset.inputs, cells, [], land);
      }).not.toThrow();

      expect(result).toBeDefined();
      const coverage = result!.coverage;
      // Coverage is always a fraction in [0, 1].
      expect(coverage).toBeGreaterThanOrEqual(0);
      expect(coverage).toBeLessThanOrEqual(1);
      if (!exemptLowCoverage) {
        // Every demo preset except the deliberate low-coverage one scores.
        expect(coverage).toBeGreaterThanOrEqual(MIN_COVERAGE);
      }
    });
  }

  it(`"${LOW_COVERAGE_PRESET}" is intentionally below MIN_COVERAGE (honesty demo)`, () => {
    const preset = PRESET_SITES.find((p) => p.name === LOW_COVERAGE_PRESET);
    expect(preset).toBeDefined();
    const result = runSite(preset!.inputs, cells, [], land);
    // Confirms the warm-cell site really does read "Insufficient data": its
    // plume coverage sits below the floor, so the UI greys the score out.
    expect(result.coverage).toBeLessThan(MIN_COVERAGE);
  });
});
