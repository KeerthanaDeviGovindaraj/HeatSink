import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  braytonFraction,
  formatBraytonPercent,
  formatFlowM3s,
  formatFlowMGD,
  formatHeatMW,
  heatMW,
  roundTo,
} from '../../src/components/flowCard';
import {
  DEFAULT_SITE_PARAMS,
  SLIDER_SPECS,
} from '../../src/components/siteParams';
import { computeThermal } from '../../src/model/thermal';
import {
  BOUNDS,
  BRAYTON_PEAK_MGD,
  CP_J_KG_K,
  MGD_PER_M3S,
  RHO_KG_M3,
  W_PER_MW,
} from '../../src/model/constants';
import type { SiteInputs, ThermalResult } from '../../src/model/types';

/** Build a ThermalResult from in-bounds facility params at a fixed location. */
function compute(params: Partial<SiteInputs> = {}): ThermalResult {
  return computeThermal({ lat: 42.3, lon: -70.7, ...DEFAULT_SITE_PARAMS, ...params });
}

describe('flowCard helpers (R3.5)', () => {
  // heatMW is heatW / W_PER_MW. Validates: Requirements 3.5
  it('heatMW converts watts to megawatts exactly', () => {
    fc.assert(
      fc.property(
        fc.double({
          min: BOUNDS.facilityMW.min,
          max: BOUNDS.facilityMW.max,
          noNaN: true,
          noDefaultInfinity: true,
        }),
        (facilityMW) => {
          const result = compute({ facilityMW });
          expect(heatMW(result)).toBeCloseTo(result.heatW / W_PER_MW, 9);
          // With the default 0.88 heat fraction, MW = 0.88 × facilityMW.
          expect(heatMW(result)).toBeCloseTo(facilityMW * 0.88, 6);
        },
      ),
    );
  });

  // braytonFraction = flowMGD / BRAYTON_PEAK_MGD, clamped to [0, 1].
  // Validates: Requirements 3.5
  it('braytonFraction is flowMGD/BRAYTON_PEAK_MGD clamped to [0,1]', () => {
    expect(braytonFraction(0)).toBe(0);
    expect(braytonFraction(-5)).toBe(0);
    expect(braytonFraction(NaN)).toBe(0);
    expect(braytonFraction(BRAYTON_PEAK_MGD / 2)).toBeCloseTo(0.5, 9);
    expect(braytonFraction(BRAYTON_PEAK_MGD)).toBe(1);
    // Above the reference saturates at 1 (bar never overflows).
    expect(braytonFraction(BRAYTON_PEAK_MGD * 3)).toBe(1);
  });

  it('braytonFraction stays within [0,1] for any flow', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1e6, noNaN: true, noDefaultInfinity: true }),
        (flowMGD) => {
          const f = braytonFraction(flowMGD);
          expect(f).toBeGreaterThanOrEqual(0);
          expect(f).toBeLessThanOrEqual(1);
        },
      ),
    );
  });

  it('roundTo rounds to the requested precision', () => {
    expect(roundTo(3.14159, 2)).toBe(3.14);
    expect(roundTo(99.6, 0)).toBe(100);
  });

  // Sanity anchor from thermal-model.md: 90 MW @ ΔT 5 °C, heatFraction 1,
  // mixRatio 0 ≈ 4.40 m³/s ≈ 100 MGD, so the Brayton bar sits near 10%.
  // heatFraction 1 is out of the UI bounds, so this builds a raw ThermalResult
  // (matching thermal.test.ts's raw sanity check) rather than calling
  // computeThermal. Validates: Requirements 3.5
  it('anchors on the documented 90 MW / ΔT 5 case (≈4.40 m³/s ≈100 MGD)', () => {
    const heatW = 90 * W_PER_MW; // heatFraction = 1 (full power to water)
    const flowM3s = heatW / (RHO_KG_M3 * CP_J_KG_K * 5);
    const flowMGD = flowM3s * MGD_PER_M3S;
    const result: ThermalResult = {
      heatW,
      flowM3s,
      flowMGD,
      totalFlowM3s: flowM3s,
      deltaTEffC: 5,
      decayLengthM: 0,
      reachM: 0,
    };
    expect(heatMW(result)).toBeCloseTo(90, 6);
    expect(result.flowM3s).toBeCloseTo(4.4, 1);
    expect(result.flowMGD).toBeCloseTo(100, 0);
    expect(braytonFraction(result.flowMGD)).toBeCloseTo(0.1, 1);
  });

  it('formats the card fields with units', () => {
    // Use in-bounds params so computeThermal does not throw.
    const result = compute({ facilityMW: 90, deltaTC: 5, mixRatio: 0, heatFraction: 0.88 });
    expect(formatHeatMW(result)).toBe('79 MW'); // 90 × 0.88 = 79.2 → 79
    expect(formatFlowM3s(result)).toMatch(/ m³\/s$/);
    expect(formatFlowMGD(result)).toMatch(/ MGD$/);
    expect(formatBraytonPercent(result.flowMGD)).toMatch(/^\d+%$/);
  });
});

describe('SiteEditor slider metadata (R3.3)', () => {
  // The slider min/max must be sourced from BOUNDS, and defaults must match the
  // R3.3 defaults carried in DEFAULT_SITE_PARAMS. Validates: Requirements 3.3
  it('every slider spec has a matching BOUNDS entry and R3.3 default', () => {
    const keys = SLIDER_SPECS.map((s) => s.key).sort();
    expect(keys).toEqual(
      (['deltaTC', 'facilityMW', 'heatFraction', 'mixRatio'] as const).slice(),
    );
    for (const spec of SLIDER_SPECS) {
      const bound = BOUNDS[spec.key];
      expect(bound).toBeDefined();
      // Default lies within the bound.
      expect(spec.defaultValue).toBeGreaterThanOrEqual(bound.min);
      expect(spec.defaultValue).toBeLessThanOrEqual(bound.max);
      // Default matches the R3.3 default params.
      expect(spec.defaultValue).toBe(DEFAULT_SITE_PARAMS[spec.key]);
      // Step is positive and no larger than the full range.
      expect(spec.step).toBeGreaterThan(0);
      expect(spec.step).toBeLessThanOrEqual(bound.max - bound.min);
    }
  });

  it('matches the R3.3 default values exactly', () => {
    expect(DEFAULT_SITE_PARAMS.facilityMW).toBe(100);
    expect(DEFAULT_SITE_PARAMS.deltaTC).toBe(4);
    expect(DEFAULT_SITE_PARAMS.mixRatio).toBe(0);
    expect(DEFAULT_SITE_PARAMS.heatFraction).toBe(0.88);
  });
});
