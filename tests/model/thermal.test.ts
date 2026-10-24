import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeThermal } from '../../src/model/thermal';
import {
  BOUNDS,
  CP_J_KG_K,
  MGD_PER_M3S,
  RHO_KG_M3,
  R_REF_M,
  W_PER_MW,
} from '../../src/model/constants';
import { InputRangeError, type SiteInputs } from '../../src/model/types';

/**
 * Generator for site inputs constrained to the valid bounds (thermal-model.md).
 * lat/lon are not bounded by computeThermal, so fixed Massachusetts Bay-ish
 * values are used; only the thermal/hydraulic fields drive the computation.
 */
const validInputsArb: fc.Arbitrary<SiteInputs> = fc.record({
  lat: fc.constant(42.3),
  lon: fc.constant(-70.7),
  facilityMW: fc.double({
    min: BOUNDS.facilityMW.min,
    max: BOUNDS.facilityMW.max,
    noNaN: true,
    noDefaultInfinity: true,
  }),
  deltaTC: fc.double({
    min: BOUNDS.deltaTC.min,
    max: BOUNDS.deltaTC.max,
    noNaN: true,
    noDefaultInfinity: true,
  }),
  mixRatio: fc.double({
    min: BOUNDS.mixRatio.min,
    max: BOUNDS.mixRatio.max,
    noNaN: true,
    noDefaultInfinity: true,
  }),
  heatFraction: fc.double({
    min: BOUNDS.heatFraction.min,
    max: BOUNDS.heatFraction.max,
    noNaN: true,
    noDefaultInfinity: true,
  }),
});

describe('thermal', () => {
  // Property P1 — energy conservation. Validates: Requirements 10.1
  // FOR ANY valid inputs, RHO·CP·totalFlowM3s·deltaTEffC == heatW within relative
  // error 1e-9. Pre-mixing redistributes ΔT and flow but must conserve heat.
  it('P1: RHO·CP·totalFlowM3s·deltaTEffC ≈ heatW for any valid inputs (R10.1)', () => {
    fc.assert(
      fc.property(validInputsArb, (inputs) => {
        const { heatW, totalFlowM3s, deltaTEffC } = computeThermal(inputs);
        const reconstructedHeatW = RHO_KG_M3 * CP_J_KG_K * totalFlowM3s * deltaTEffC;
        const toleranceW = 1e-9 * heatW;
        expect(Math.abs(reconstructedHeatW - heatW)).toBeLessThanOrEqual(toleranceW);
      }),
    );
  });

  // Property P5 — linearity in facility power. Validates: Requirements 10.3
  // WHEN facilityMW doubles within bounds and all else is equal, flowM3s doubles.
  // flowM3s is linear in heatW which is linear in facilityMW, so the ratio is 2.
  it('P5: doubling facilityMW doubles flowM3s, all else equal (R10.3)', () => {
    fc.assert(
      fc.property(
        fc.record({
          // Keep facilityMW ≤ max/2 so the doubled value stays within bounds.
          facilityMW: fc.double({
            min: BOUNDS.facilityMW.min,
            max: BOUNDS.facilityMW.max / 2,
            noNaN: true,
            noDefaultInfinity: true,
          }),
          deltaTC: fc.double({
            min: BOUNDS.deltaTC.min,
            max: BOUNDS.deltaTC.max,
            noNaN: true,
            noDefaultInfinity: true,
          }),
          mixRatio: fc.double({
            min: BOUNDS.mixRatio.min,
            max: BOUNDS.mixRatio.max,
            noNaN: true,
            noDefaultInfinity: true,
          }),
          heatFraction: fc.double({
            min: BOUNDS.heatFraction.min,
            max: BOUNDS.heatFraction.max,
            noNaN: true,
            noDefaultInfinity: true,
          }),
        }),
        ({ facilityMW, deltaTC, mixRatio, heatFraction }) => {
          const base: SiteInputs = { lat: 42.3, lon: -70.7, facilityMW, deltaTC, mixRatio, heatFraction };
          const doubled: SiteInputs = { ...base, facilityMW: facilityMW * 2 };
          const baseFlowM3s = computeThermal(base).flowM3s;
          const doubledFlowM3s = computeThermal(doubled).flowM3s;
          const toleranceM3s = 1e-9 * (2 * baseFlowM3s);
          expect(Math.abs(doubledFlowM3s - 2 * baseFlowM3s)).toBeLessThanOrEqual(toleranceM3s);
        },
      ),
    );
  });

  // Property P6 — mixing lowers temperature. Validates: Requirements 10.4
  // WHEN mixRatio > 0, deltaTEffC < deltaTC and heatW is unchanged by mixing.
  // deltaTEffC = deltaTC / (1 + m) < deltaTC for m > 0; heatW ignores mixRatio.
  it('P6: mixRatio > 0 ⇒ deltaTEffC < deltaTC, heatW unchanged (R10.4)', () => {
    fc.assert(
      fc.property(
        fc.record({
          facilityMW: fc.double({
            min: BOUNDS.facilityMW.min,
            max: BOUNDS.facilityMW.max,
            noNaN: true,
            noDefaultInfinity: true,
          }),
          deltaTC: fc.double({
            min: BOUNDS.deltaTC.min,
            max: BOUNDS.deltaTC.max,
            noNaN: true,
            noDefaultInfinity: true,
          }),
          // Strictly positive, physically meaningful mixing. A minimum of 1e-6
          // (not the smallest denormal double) keeps m > 0 while excluding values
          // so tiny that 1 + m rounds back to 1.0 in IEEE-754 and the mixing has
          // no representable effect. That sub-epsilon regime is not real mixing,
          // so sampling it would test float rounding, not the P6 property.
          mixRatio: fc.double({
            min: 1e-6,
            max: BOUNDS.mixRatio.max,
            noNaN: true,
            noDefaultInfinity: true,
          }),
          heatFraction: fc.double({
            min: BOUNDS.heatFraction.min,
            max: BOUNDS.heatFraction.max,
            noNaN: true,
            noDefaultInfinity: true,
          }),
        }),
        ({ facilityMW, deltaTC, mixRatio, heatFraction }) => {
          const mixed: SiteInputs = { lat: 42.3, lon: -70.7, facilityMW, deltaTC, mixRatio, heatFraction };
          const unmixed: SiteInputs = { ...mixed, mixRatio: 0 };
          const mixedResult = computeThermal(mixed);
          const unmixedResult = computeThermal(unmixed);
          // Mixing strictly lowers the effective temperature rise.
          expect(mixedResult.deltaTEffC).toBeLessThan(deltaTC);
          // Heat to water does not depend on mixing.
          expect(mixedResult.heatW).toBe(unmixedResult.heatW);
        },
      ),
    );
  });

  // Property P11 — reach bound. Validates: Requirements 10.1
  // FOR ANY valid inputs, reachM ≤ R_REF_M (the sampling disc contains the plume).
  it('P11: reachM ≤ R_REF_M for any valid inputs (R10.1)', () => {
    fc.assert(
      fc.property(validInputsArb, (inputs) => {
        const { reachM } = computeThermal(inputs);
        expect(reachM).toBeLessThanOrEqual(R_REF_M);
      }),
    );
  });

  // Unit test — flow sanity. Validates: Requirements 10.3, 10.4
  // 90 MW at ΔT = 5 °C (heatFraction = 1, mixRatio = 0) ≈ 4.40 m³/s ≈ 100 MGD.
  // thermal-model.md gives this as the calibration sanity check; heatFraction is
  // pinned to 1 so the 90 MW is fully delivered to water.
  it('unit: 90 MW at ΔT 5 °C ≈ 4.40 m³/s ≈ 100 MGD (R10.3, R10.4)', () => {
    const facilityMW = 90;
    const deltaTC = 5;
    const heatFraction = 1; // out of UI bounds, but valid for the raw sanity check
    const heatW = facilityMW * W_PER_MW * heatFraction;
    const flowM3s = heatW / (RHO_KG_M3 * CP_J_KG_K * deltaTC);
    const flowMGD = flowM3s * MGD_PER_M3S;
    expect(flowM3s).toBeCloseTo(4.4, 1);
    expect(flowMGD).toBeCloseTo(100, 0);
  });

  // Unit test — computeThermal matches the sanity flow at an in-bounds heatFraction.
  // With heatFraction 0.88 the delivered heat is 0.88×, so flow scales the same.
  it('unit: computeThermal flow scales with heatFraction (R10.3)', () => {
    const inputs: SiteInputs = {
      lat: 42.3,
      lon: -70.7,
      facilityMW: 90,
      deltaTC: 5,
      mixRatio: 0,
      heatFraction: 0.88,
    };
    const { heatW, flowM3s, flowMGD } = computeThermal(inputs);
    expect(heatW).toBeCloseTo(90 * W_PER_MW * 0.88, 0);
    // Expected flow = 0.88 × the 4.40 m³/s full-power value ≈ 3.87 m³/s.
    const expectedFlowM3s = (90 * W_PER_MW * 0.88) / (RHO_KG_M3 * CP_J_KG_K * 5);
    expect(flowM3s).toBeCloseTo(expectedFlowM3s, 6);
    expect(flowMGD).toBeCloseTo(expectedFlowM3s * MGD_PER_M3S, 6);
  });

  // InputRangeError tests. Validates: Requirements 10.1
  // WHEN any bounded field is out of range (or non-finite), computeThermal throws
  // InputRangeError. One case per bound (below min and above max) plus NaN/Infinity.
  describe('InputRangeError on out-of-range inputs (R10.1)', () => {
    const inBounds: SiteInputs = {
      lat: 42.3,
      lon: -70.7,
      facilityMW: 100,
      deltaTC: 5,
      mixRatio: 1,
      heatFraction: 0.88,
    };

    const outOfRangeCases: Array<[string, Partial<SiteInputs>]> = [
      ['facilityMW below min', { facilityMW: BOUNDS.facilityMW.min - 0.5 }],
      ['facilityMW above max', { facilityMW: BOUNDS.facilityMW.max + 1 }],
      ['deltaTC below min', { deltaTC: BOUNDS.deltaTC.min - 0.5 }],
      ['deltaTC above max', { deltaTC: BOUNDS.deltaTC.max + 1 }],
      ['mixRatio below min', { mixRatio: BOUNDS.mixRatio.min - 0.5 }],
      ['mixRatio above max', { mixRatio: BOUNDS.mixRatio.max + 1 }],
      ['heatFraction below min', { heatFraction: BOUNDS.heatFraction.min - 0.01 }],
      ['heatFraction above max', { heatFraction: BOUNDS.heatFraction.max + 0.01 }],
      ['facilityMW NaN', { facilityMW: Number.NaN }],
      ['deltaTC Infinity', { deltaTC: Number.POSITIVE_INFINITY }],
    ];

    for (const [label, override] of outOfRangeCases) {
      it(`throws InputRangeError: ${label}`, () => {
        expect(() => computeThermal({ ...inBounds, ...override })).toThrow(InputRangeError);
      });
    }

    it('does not throw for in-bounds inputs', () => {
      expect(() => computeThermal(inBounds)).not.toThrow();
    });

    // Property: any input generated outside the bounds (one field at a time)
    // throws InputRangeError. Validates: Requirements 10.1
    it('P-err: out-of-range field always throws InputRangeError (R10.1)', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc
              .double({ min: BOUNDS.facilityMW.max + 1e-6, max: 1e9, noNaN: true, noDefaultInfinity: true })
              .map((facilityMW): Partial<SiteInputs> => ({ facilityMW })),
            fc
              .double({ min: BOUNDS.deltaTC.max + 1e-6, max: 1e9, noNaN: true, noDefaultInfinity: true })
              .map((deltaTC): Partial<SiteInputs> => ({ deltaTC })),
            fc
              .double({ min: BOUNDS.mixRatio.max + 1e-6, max: 1e9, noNaN: true, noDefaultInfinity: true })
              .map((mixRatio): Partial<SiteInputs> => ({ mixRatio })),
            fc
              .double({ min: BOUNDS.heatFraction.max + 1e-6, max: 1e9, noNaN: true, noDefaultInfinity: true })
              .map((heatFraction): Partial<SiteInputs> => ({ heatFraction })),
          ),
          (override) => {
            expect(() => computeThermal({ ...inBounds, ...override })).toThrow(InputRangeError);
          },
        ),
      );
    });
  });
});
