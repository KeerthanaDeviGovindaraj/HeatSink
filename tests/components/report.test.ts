// tests/components/report.test.ts — Task 8.1 (requirements R7.1, R7.2).
//
// Pure-generator tests for src/components/report.ts. No @testing-library/react
// (node env): we exercise buildSummaryMarkdown against REAL SiteResults produced
// by runSite over the committed FIShBOT snapshot + presets (read from disk like
// presets.test.ts), plus the committed species.json and a fixed meta fixture.
//
// Covered:
//   - DETERMINISM (R7.1): same args → identical string (called twice).
//   - Every required section is present (inputs, flow, plume, coverage, species,
//     assumptions, sources, disclaimer).
//   - Species lines match the CompareTable classification (R6.2/R6.5) and show
//     "(unverified)" for unverified entries (R5.3).
//   - Sources use the fixed UTC formatter; filename is coordinate-derived.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { FeatureCollection } from 'geojson';

import {
  SCREENING_DISCLAIMER,
  buildSummaryMarkdown,
  summaryFileName,
} from '../../src/components/report';
import { speciesCellLabel, hasSufficientCoverage } from '../../src/components/compare';
import { displayableSpecies, toModelSpecies } from '../../src/components/species';
import { baselineCellsFromSnapshot } from '../../src/data/loaders';
import type { OceanRow, Snapshot, SpeciesEntry, SpeciesFile } from '../../src/data/types';
import type { SourceMetas } from '../../src/data/useSnapshots';
import { MIN_COVERAGE } from '../../src/model/constants';
import { PRESET_SITES } from '../../src/model/presets';
import { runSite } from '../../src/model/runSite';
import type { BaselineCell, SiteResult, Species } from '../../src/model/types';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, '../../public/data');

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(dataDir, name), 'utf8')) as T;
}

const snapshot = readJson<Snapshot<OceanRow>>('fishbot.json');
const land = readJson<FeatureCollection>('ma-land.geojson');
const speciesFile = readJson<SpeciesFile>('species.json');
const cells: BaselineCell[] = baselineCellsFromSnapshot(snapshot);

// The shown (displayable) species, and the model-shaped species for runSite.
const shownSpecies: SpeciesEntry[] = displayableSpecies(speciesFile.species);
const modelSpecies: Species[] = shownSpecies.map(toModelSpecies);

// A fixed meta fixture so Sources assertions don't depend on the committed
// snapshot's live fetchedAt (R7.1 determinism is about the generator, not the
// data). formatFetchedAt turns this into a stable UTC string.
const METAS: SourceMetas = {
  fishbot: {
    source: 'FIShBOT gridded daily average',
    url: 'https://example.test/fishbot',
    fetchedAt: '2026-10-24T17:46:31.126Z',
    window: '2026-10-17/2026-10-24',
    rowCount: 100,
    droppedCount: 0,
  },
  emolt: {
    source: 'eMOLT bottom temperature',
    url: 'https://example.test/emolt',
    fetchedAt: '2026-10-24T17:46:31.126Z',
    window: '2026-10-17/2026-10-24',
    rowCount: 50,
    droppedCount: 0,
  },
};

/** Compute a real result for a preset, with species so risks are populated. */
function resultFor(index: number): SiteResult {
  return runSite(PRESET_SITES[index].inputs, cells, modelSpecies, land);
}

const presetResults: SiteResult[] = PRESET_SITES.map((_, i) => resultFor(i));

describe('buildSummaryMarkdown (R7.1, R7.2)', () => {
  it('is deterministic: same args produce the identical string', () => {
    for (const [i, result] of presetResults.entries()) {
      const args = {
        result,
        species: shownSpecies,
        metas: METAS,
        siteLabel: PRESET_SITES[i].name,
      };
      const a = buildSummaryMarkdown(args);
      const b = buildSummaryMarkdown(args);
      expect(a).toBe(b);
    }
  });

  it('contains every required section heading', () => {
    const md = buildSummaryMarkdown({
      result: presetResults[0],
      species: shownSpecies,
      metas: METAS,
      siteLabel: PRESET_SITES[0].name,
    });
    expect(md).toContain('## Inputs');
    expect(md).toContain('## Flow');
    expect(md).toContain('## Plume');
    expect(md).toContain('## Coverage');
    expect(md).toContain('## Species results');
    expect(md).toContain('## Assumptions');
    expect(md).toContain('## Sources');
    expect(md).toContain('## Disclaimer');
  });

  it('includes the site label, coordinates and the screening disclaimer', () => {
    const md = buildSummaryMarkdown({
      result: presetResults[0],
      species: shownSpecies,
      metas: METAS,
      siteLabel: PRESET_SITES[0].name,
    });
    expect(md).toContain(PRESET_SITES[0].name);
    const { lat, lon } = presetResults[0].inputs;
    expect(md).toContain(String(lat));
    expect(md).toContain(String(lon));
    expect(md).toContain(SCREENING_DISCLAIMER);
    expect(md).toContain('Not a permit decision.');
  });

  it('surfaces the MODELED placeholder constants in Assumptions', () => {
    const md = buildSummaryMarkdown({
      result: presetResults[0],
      species: shownSpecies,
      metas: METAS,
    });
    expect(md).toContain('AREA_SCALE_KM2');
    expect(md).toContain('MIN_COVERAGE');
    expect(md).toContain('NEGLIGIBLE_C');
    expect(md).toContain('SHALLOW_DEPTH_M');
    expect(md).toContain('R_REF_M');
  });

  it('lists each loaded source with a fixed-format UTC timestamp', () => {
    const md = buildSummaryMarkdown({
      result: presetResults[0],
      species: shownSpecies,
      metas: METAS,
    });
    expect(md).toContain('FIShBOT');
    expect(md).toContain('eMOLT');
    // NDBC meta was not provided, so it must not appear.
    expect(md).not.toContain('NDBC');
    // Fixed UTC shape from formatFetchedAt (not locale-dependent).
    expect(md).toContain('Oct 24, 2026, 17:46 UTC');
  });

  it('falls back to "No sources loaded." when no metas are present', () => {
    const md = buildSummaryMarkdown({
      result: presetResults[0],
      species: shownSpecies,
      metas: {},
    });
    expect(md).toContain('No sources loaded.');
  });

  it('species lines match the CompareTable classification (R6.2/R6.5)', () => {
    for (const result of presetResults) {
      const md = buildSummaryMarkdown({ result, species: shownSpecies, metas: METAS });
      const minCoverageMet = hasSufficientCoverage(result);
      const riskById = new Map(result.risks.map((r) => [r.speciesId, r]));
      for (const s of shownSpecies) {
        const risk = riskById.get(s.id);
        expect(risk).toBeDefined();
        const expectedText = speciesCellLabel(risk!, { minCoverageMet }).text;
        // The species name and its exact cell classification both appear.
        expect(md).toContain(s.name);
        expect(md).toContain(expectedText);
      }
    }
  });

  it('marks unverified species with "(unverified)" (R5.3)', () => {
    const md = buildSummaryMarkdown({
      result: presetResults[0],
      species: shownSpecies,
      metas: METAS,
    });
    // Both committed species are verified:false by design.
    for (const s of shownSpecies) {
      if (!s.verified) {
        expect(md).toContain(`${s.name} (unverified)`);
      }
    }
  });

  it('handles an empty species list without throwing', () => {
    const md = buildSummaryMarkdown({
      result: presetResults[0],
      species: [],
      metas: METAS,
    });
    expect(md).toContain('No species selected.');
  });

  it('reports coverage and whether it meets the minimum', () => {
    for (const result of presetResults) {
      const md = buildSummaryMarkdown({ result, species: shownSpecies, metas: METAS });
      const met = result.coverage >= MIN_COVERAGE;
      expect(md).toContain(met ? 'meets' : 'below');
    }
  });

  // Property: determinism holds across arbitrary (but valid) subsets of the
  // shown species and label choices — the generator must never depend on
  // anything outside its arguments.
  it('property: identical args always yield identical output', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: PRESET_SITES.length - 1 }),
        fc.subarray(shownSpecies),
        fc.option(fc.string(), { nil: undefined }),
        (i, species, siteLabel) => {
          const args = { result: presetResults[i], species, metas: METAS, siteLabel };
          return buildSummaryMarkdown(args) === buildSummaryMarkdown(args);
        },
      ),
    );
  });
});

describe('summaryFileName (R7.2)', () => {
  it('derives a coordinate-based .md filename deterministically', () => {
    for (const result of presetResults) {
      const name = summaryFileName(result);
      expect(name.startsWith('heatsink-summary-')).toBe(true);
      expect(name.endsWith('.md')).toBe(true);
      // Coordinate dots are replaced with underscores — only the extension dot
      // remains.
      expect(name.slice(0, -'.md'.length)).not.toContain('.');
      // determinism
      expect(summaryFileName(result)).toBe(name);
    }
  });
});
