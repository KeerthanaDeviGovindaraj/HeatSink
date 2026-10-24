// tests/components/compare.test.ts — Task 7.2 (requirements R6.2, R6.4, R6.5).
//
// Pure-helper tests for src/components/compare.ts. No @testing-library/react
// (node env): we exercise rankSites / siteRiskScore / speciesCellLabel against
// (a) minimal hand-built SiteResult fixtures for precise control of coverage,
// scores and newly-exceeded area, and (b) REAL SiteResults produced by runSite
// over the committed FIShBOT snapshot + presets (read from disk like
// presets.test.ts) so the ranking is tested on realistic inputs.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { FeatureCollection } from 'geojson';

import {
  hasSufficientCoverage,
  rankSites,
  siteRiskScore,
  speciesCellLabel,
  type SavedSite,
} from '../../src/components/compare';
import { MIN_COVERAGE } from '../../src/model/constants';
import { PRESET_SITES } from '../../src/model/presets';
import { runSite } from '../../src/model/runSite';
import { baselineCellsFromSnapshot } from '../../src/data/loaders';
import type { OceanRow, Snapshot } from '../../src/data/types';
import type {
  BaselineCell,
  Level,
  SiteResult,
  SpeciesRisk,
  ThermalResult,
} from '../../src/model/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A throwaway ThermalResult; compare helpers never read it. */
const THERMAL: ThermalResult = {
  heatW: 0,
  flowM3s: 0,
  flowMGD: 0,
  totalFlowM3s: 0,
  deltaTEffC: 0,
  decayLengthM: 0,
  reachM: 0,
};

function makeRisk(partial: Partial<SpeciesRisk> = {}): SpeciesRisk {
  return {
    speciesId: 'sp',
    newlyExceededKm2: 1,
    alreadyExceededKm2: 0,
    score: 20,
    level: 'Medium',
    ...partial,
  };
}

/** Build a minimal SiteResult with a given coverage, plume area, and risks. */
function makeResult(opts: {
  coverage: number;
  plumeAreaKm2?: number;
  risks?: SpeciesRisk[];
  lat?: number;
  lon?: number;
}): SiteResult {
  return {
    inputs: {
      lat: opts.lat ?? 42,
      lon: opts.lon ?? -70,
      facilityMW: 100,
      deltaTC: 4,
      mixRatio: 0,
      heatFraction: 0.88,
    },
    thermal: THERMAL,
    points: [],
    plumeAreaKm2: opts.plumeAreaKm2 ?? 1,
    coverage: opts.coverage,
    risks: opts.risks ?? [makeRisk()],
  };
}

function makeSite(id: string, result: SiteResult, label = id): SavedSite {
  return { id, label, result };
}

// Real SiteResults over the committed snapshot (realistic ranking inputs).
const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, '../../public/data');
const snapshot = JSON.parse(
  readFileSync(resolve(dataDir, 'fishbot.json'), 'utf8'),
) as Snapshot<OceanRow>;
const land = JSON.parse(
  readFileSync(resolve(dataDir, 'ma-land.geojson'), 'utf8'),
) as FeatureCollection;
const cells: BaselineCell[] = baselineCellsFromSnapshot(snapshot);
const species = [
  { id: 'lobster', name: 'Lobster', thresholdC: 20, source: 'x', verified: false },
];
const realResults: SiteResult[] = PRESET_SITES.map((p) =>
  runSite(p.inputs, cells, species, land),
);

// ---------------------------------------------------------------------------
// siteRiskScore
// ---------------------------------------------------------------------------

describe('siteRiskScore (R6.4)', () => {
  it('is the maximum per-species score', () => {
    const result = makeResult({
      coverage: 1,
      risks: [
        makeRisk({ score: 12 }),
        makeRisk({ score: 47 }),
        makeRisk({ score: 3 }),
      ],
    });
    expect(siteRiskScore(result)).toBe(47);
  });

  it('is 0 when there are no species risks', () => {
    expect(siteRiskScore(makeResult({ coverage: 1, risks: [] }))).toBe(0);
  });

  it('stays within [0, 100] for any per-species scores', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 0, max: 100, noNaN: true }), {
          minLength: 0,
          maxLength: 6,
        }),
        (scores) => {
          const risks = scores.map((s) => makeRisk({ score: s }));
          const value = siteRiskScore(makeResult({ coverage: 1, risks }));
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(100);
        },
      ),
    );
  });

  it('is in [0, 100] for the real preset results', () => {
    for (const r of realResults) {
      const value = siteRiskScore(r);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });
});

// ---------------------------------------------------------------------------
// rankSites
// ---------------------------------------------------------------------------

describe('rankSites (R6.4 — lowest risk first)', () => {
  it('orders sufficient-coverage sites by ascending risk score', () => {
    const high = makeSite(
      'high',
      makeResult({ coverage: 1, risks: [makeRisk({ score: 80 })] }),
    );
    const low = makeSite(
      'low',
      makeResult({ coverage: 1, risks: [makeRisk({ score: 5 })] }),
    );
    const mid = makeSite(
      'mid',
      makeResult({ coverage: 1, risks: [makeRisk({ score: 30 })] }),
    );
    const ranked = rankSites([high, low, mid]);
    expect(ranked.map((s) => s.id)).toEqual(['low', 'mid', 'high']);
  });

  it('breaks score ties by ascending plume area', () => {
    const big = makeSite(
      'big',
      makeResult({ coverage: 1, plumeAreaKm2: 9, risks: [makeRisk({ score: 10 })] }),
    );
    const small = makeSite(
      'small',
      makeResult({ coverage: 1, plumeAreaKm2: 2, risks: [makeRisk({ score: 10 })] }),
    );
    expect(rankSites([big, small]).map((s) => s.id)).toEqual(['small', 'big']);
  });

  it('sorts insufficient-data sites last even if their score is lower', () => {
    const insufficientLowScore = makeSite(
      'insuff',
      makeResult({
        coverage: MIN_COVERAGE - 0.1,
        risks: [makeRisk({ score: 1, level: 'Insufficient data' })],
      }),
    );
    const sufficientHighScore = makeSite(
      'suff',
      makeResult({ coverage: 1, risks: [makeRisk({ score: 90 })] }),
    );
    const ranked = rankSites([insufficientLowScore, sufficientHighScore]);
    expect(ranked.map((s) => s.id)).toEqual(['suff', 'insuff']);
  });

  it('does not mutate its input array', () => {
    const sites = [
      makeSite('a', makeResult({ coverage: 1, risks: [makeRisk({ score: 50 })] })),
      makeSite('b', makeResult({ coverage: 1, risks: [makeRisk({ score: 10 })] })),
    ];
    const before = sites.map((s) => s.id);
    rankSites(sites);
    expect(sites.map((s) => s.id)).toEqual(before);
  });

  it('always yields non-decreasing risk within the sufficient-coverage prefix', () => {
    const arb = fc.record({
      coverage: fc.double({ min: 0, max: 1, noNaN: true }),
      plumeAreaKm2: fc.double({ min: 0, max: 50, noNaN: true }),
      score: fc.double({ min: 0, max: 100, noNaN: true }),
    });
    fc.assert(
      fc.property(fc.array(arb, { minLength: 0, maxLength: 5 }), (specs) => {
        const sites = specs.map((s, i) =>
          makeSite(
            `s${i}`,
            makeResult({
              coverage: s.coverage,
              plumeAreaKm2: s.plumeAreaKm2,
              risks: [makeRisk({ score: s.score })],
            }),
          ),
        );
        const ranked = rankSites(sites);
        // All sufficient-coverage sites precede any insufficient one.
        const firstInsuff = ranked.findIndex(
          (s) => !hasSufficientCoverage(s.result),
        );
        if (firstInsuff !== -1) {
          for (let i = firstInsuff; i < ranked.length; i++) {
            expect(hasSufficientCoverage(ranked[i].result)).toBe(false);
          }
        }
        // Risk scores are non-decreasing across the sufficient-coverage prefix.
        const prefix =
          firstInsuff === -1 ? ranked : ranked.slice(0, firstInsuff);
        for (let i = 1; i < prefix.length; i++) {
          expect(siteRiskScore(prefix[i].result)).toBeGreaterThanOrEqual(
            siteRiskScore(prefix[i - 1].result),
          );
        }
        // Ranking is a permutation (same length, same ids).
        expect(ranked).toHaveLength(sites.length);
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// speciesCellLabel
// ---------------------------------------------------------------------------

describe('speciesCellLabel (R6.2, R6.5)', () => {
  it('shows "Insufficient data" greyed when coverage is below MIN_COVERAGE (R6.2)', () => {
    const label = speciesCellLabel(makeRisk({ newlyExceededKm2: 3, score: 40 }), {
      minCoverageMet: false,
    });
    expect(label).toEqual({
      text: 'Insufficient data',
      insufficient: true,
      lowImpact: false,
    });
  });

  it('shows "Low impact at screening level" when newly === 0 and coverage is sufficient (R6.5)', () => {
    const label = speciesCellLabel(
      makeRisk({ newlyExceededKm2: 0, score: 0, level: 'Low' }),
      { minCoverageMet: true },
    );
    expect(label.lowImpact).toBe(true);
    expect(label.insufficient).toBe(false);
    expect(label.text).toBe('Low impact at screening level');
  });

  it('shows the rounded score and level otherwise', () => {
    const label = speciesCellLabel(
      makeRisk({ newlyExceededKm2: 2, score: 42.6, level: 'High' }),
      { minCoverageMet: true },
    );
    expect(label).toEqual({
      text: '43 · High',
      insufficient: false,
      lowImpact: false,
    });
  });

  it('insufficient coverage takes precedence over a zero newly-exceeded area', () => {
    const label = speciesCellLabel(makeRisk({ newlyExceededKm2: 0 }), {
      minCoverageMet: false,
    });
    expect(label.insufficient).toBe(true);
    expect(label.lowImpact).toBe(false);
  });

  it('is mutually exclusive: never both insufficient and lowImpact', () => {
    const levels: Level[] = ['Low', 'Medium', 'High', 'Insufficient data'];
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 50, noNaN: true }),
        fc.double({ min: 0, max: 100, noNaN: true }),
        fc.constantFrom(...levels),
        fc.boolean(),
        (newlyExceededKm2, score, level, minCoverageMet) => {
          const label = speciesCellLabel(
            makeRisk({ newlyExceededKm2, score, level }),
            { minCoverageMet },
          );
          expect(label.insufficient && label.lowImpact).toBe(false);
          if (!minCoverageMet) {
            expect(label.insufficient).toBe(true);
          } else if (newlyExceededKm2 === 0) {
            expect(label.lowImpact).toBe(true);
          } else {
            expect(label.insufficient).toBe(false);
            expect(label.lowImpact).toBe(false);
          }
          expect(label.text.length).toBeGreaterThan(0);
        },
      ),
    );
  });
});
