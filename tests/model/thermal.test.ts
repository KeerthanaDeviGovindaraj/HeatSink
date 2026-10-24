import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  computeFlow,
  excessC,
  reachM,
  validateInputs,
} from '../../src/model/thermal';
import { CP_J_KG_K, R_REF_M, RHO_KG_M3 } from '../../src/model/constants';
import { InvalidInputError, type SiteInputs } from '../../src/model/types';

const OUTFALL = { latDeg: 42, lonDeg: -70.5 };

const validInputs = fc.record({
  facilityMW: fc.double({ min: 1, max: 500, noNaN: true }),
  deltaTC: fc.double({ min: 1, max: 10, noNaN: true }),
  mixRatio: fc.double({ min: 0, max: 5, noNaN: true }),
  heatFraction: fc.double({ min: 0.8, max: 0.95, noNaN: true }),
});

function withOutfall(i: Omit<SiteInputs, 'outfall'>): SiteInputs {
  return { ...i, outfall: OUTFALL };
}

describe('thermal', () => {
  // Property 1: energy conservation.
  it('conserves energy: RHO·CP·totalFlow·deltaTEff ≈ heatW', () => {
    fc.assert(
      fc.property(validInputs, (i) => {
        const f = computeFlow(withOutfall(i));
        const recovered = RHO_KG_M3 * CP_J_KG_K * f.totalFlowM3s * f.deltaTEffC;
        expect(Math.abs(recovered - f.heatW) / f.heatW).toBeLessThan(1e-9);
      }),
    );
  });

  // Property 4: boundary excessC(0) == deltaTEffC.
  it('excess at the outfall equals the effective ΔT', () => {
    fc.assert(
      fc.property(validInputs, (i) => {
        const f = computeFlow(withOutfall(i));
        expect(excessC(0, f.deltaTEffC, f.totalFlowM3s)).toBeCloseTo(f.deltaTEffC, 12);
      }),
    );
  });

  // Properties 2 & 3: non-negative and monotonic decay.
  it('excess is non-negative and non-increasing with distance', () => {
    fc.assert(
      fc.property(
        validInputs,
        fc.double({ min: 0, max: R_REF_M, noNaN: true }),
        fc.double({ min: 0, max: R_REF_M, noNaN: true }),
        (i, a, b) => {
          const f = computeFlow(withOutfall(i));
          const [r1, r2] = a <= b ? [a, b] : [b, a];
          const e1 = excessC(r1, f.deltaTEffC, f.totalFlowM3s);
          const e2 = excessC(r2, f.deltaTEffC, f.totalFlowM3s);
          expect(e1).toBeGreaterThanOrEqual(0);
          expect(e1).toBeGreaterThanOrEqual(e2);
        },
      ),
    );
  });

  // Property 11: reach bound.
  it('plume reach never exceeds the sampling radius', () => {
    fc.assert(
      fc.property(validInputs, (i) => {
        const f = computeFlow(withOutfall(i));
        expect(reachM(f.deltaTEffC, f.totalFlowM3s)).toBeLessThanOrEqual(R_REF_M);
      }),
    );
  });

  it('rejects out-of-range inputs with a typed error', () => {
    expect(() =>
      validateInputs(withOutfall({ facilityMW: 0, deltaTC: 5, mixRatio: 0, heatFraction: 0.88 })),
    ).toThrow(InvalidInputError);
  });
});
