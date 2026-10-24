// src/model/thermal.ts — Task 2.3 (design.md, .kiro/steering/thermal-model.md v2.1).
// Pure, deterministic, no I/O. SI units internally; numeric names carry unit suffixes.
//
// Satisfies:
//   R3.3 — bounded inputs (validate against BOUNDS, throw InputRangeError).
//   R3.5 — heat to water (heatW, MW derivable) and flow in m³/s and MGD.
//   R4.5 — heat conservation under pre-mixing (RHO·CP·totalFlowM3s·deltaTEffC == heatW).

import {
  BOUNDS,
  CP_J_KG_K,
  LREF_M,
  NEGLIGIBLE_C,
  QREF_M3S,
  RHO_KG_M3,
  W_PER_MW,
} from './constants';
import { toMGD } from './units';
import { InputRangeError, type SiteInputs, type ThermalResult } from './types';

/**
 * Validate a single numeric field against an inclusive [min, max] bound.
 * Rejects non-finite values (NaN/Infinity) and out-of-range values.
 *
 * @throws {InputRangeError} when `value` is non-finite or outside [min, max].
 */
function checkBound(
  field: keyof typeof BOUNDS,
  value: number,
  min: number,
  max: number,
): void {
  if (!Number.isFinite(value)) {
    throw new InputRangeError(`${field} must be a finite number, got ${value}`);
  }
  if (value < min || value > max) {
    throw new InputRangeError(
      `${field} must be within [${min}, ${max}], got ${value}`,
    );
  }
}

/**
 * Compute the thermal/hydraulic screening result for a single discharge site.
 *
 * Validates inputs against {@link BOUNDS} (R3.3), then derives heat to water
 * (R3.5), required seawater flow in m³/s and MGD (R3.5), pre-mixing effective
 * temperature rise and total flow (heat-conserving, R4.5), the plume decay
 * length, and the negligible-excess reach, per thermal-model.md v2.1.
 *
 * All equations use constants from `constants.ts`; no magic numbers inline.
 *
 * @param inputs Site inputs. `facilityMW`, `deltaTC`, `mixRatio`, and
 *   `heatFraction` must lie within their respective bounds.
 * @returns A {@link ThermalResult} with all intermediate quantities in SI units
 *   (plus `flowMGD` for display).
 * @throws {InputRangeError} if any bounded field is non-finite or out of range.
 */
export function computeThermal(inputs: SiteInputs): ThermalResult {
  const { facilityMW, deltaTC, mixRatio, heatFraction } = inputs;

  // R3.3 — bounded inputs.
  checkBound('facilityMW', facilityMW, BOUNDS.facilityMW.min, BOUNDS.facilityMW.max);
  checkBound('deltaTC', deltaTC, BOUNDS.deltaTC.min, BOUNDS.deltaTC.max);
  checkBound('mixRatio', mixRatio, BOUNDS.mixRatio.min, BOUNDS.mixRatio.max);
  checkBound('heatFraction', heatFraction, BOUNDS.heatFraction.min, BOUNDS.heatFraction.max);

  // R3.5 — heat to water (W) and required seawater flow.
  const heatW = facilityMW * W_PER_MW * heatFraction;
  const flowM3s = heatW / (RHO_KG_M3 * CP_J_KG_K * deltaTC);
  const flowMGD = toMGD(flowM3s);

  // R4.5 — pre-mixing: lower ΔT, higher total flow; heat is conserved because
  // deltaTEffC = deltaTC/(1+m) and totalFlowM3s = flowM3s*(1+m) multiply back to
  // flowM3s*deltaTC, so RHO·CP·totalFlowM3s·deltaTEffC == heatW.
  const onePlusM = 1 + mixRatio;
  const deltaTEffC = deltaTC / onePlusM;
  const totalFlowM3s = flowM3s * onePlusM;

  // Screening plume geometry.
  const decayLengthM = LREF_M * Math.sqrt(totalFlowM3s / QREF_M3S);
  const reachM =
    deltaTEffC > NEGLIGIBLE_C
      ? decayLengthM * Math.log(deltaTEffC / NEGLIGIBLE_C)
      : 0;

  return {
    heatW,
    flowM3s,
    flowMGD,
    totalFlowM3s,
    deltaTEffC,
    decayLengthM,
    reachM,
  };
}
