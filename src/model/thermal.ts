/**
 * Heat, flow, pre-mixing, and plume equations. Pure, deterministic, no I/O.
 * See .kiro/steering/thermal-model.md.
 */
import {
  BOUNDS,
  CP_J_KG_K,
  LREF_M,
  NEGLIGIBLE_C,
  QREF_M3S,
  RHO_KG_M3,
} from './constants';
import { InvalidInputError, type FlowResult, type SiteInputs } from './types';

function assertInRange(value: number, bound: { min: number; max: number }, field: string): void {
  if (!Number.isFinite(value) || value < bound.min || value > bound.max) {
    throw new InvalidInputError(
      `${field} must be between ${bound.min} and ${bound.max} (got ${value})`,
      field,
    );
  }
}

/** Validate the numeric site inputs against thermal-model.md bounds. */
export function validateInputs(inputs: SiteInputs): void {
  assertInRange(inputs.facilityMW, BOUNDS.facilityMW, 'facilityMW');
  assertInRange(inputs.deltaTC, BOUNDS.deltaTC, 'deltaTC');
  assertInRange(inputs.mixRatio, BOUNDS.mixRatio, 'mixRatio');
  assertInRange(inputs.heatFraction, BOUNDS.heatFraction, 'heatFraction');
}

/** Heat dissipated to the water (W). */
export function heatToWater(facilityMW: number, heatFraction: number): number {
  return facilityMW * 1e6 * heatFraction;
}

/** Derive heat, required flow, effective ΔT, and total discharge flow. */
export function computeFlow(inputs: SiteInputs): FlowResult {
  validateInputs(inputs);
  const heatW = heatToWater(inputs.facilityMW, inputs.heatFraction);
  const flowM3s = heatW / (RHO_KG_M3 * CP_J_KG_K * inputs.deltaTC);
  const deltaTEffC = inputs.deltaTC / (1 + inputs.mixRatio);
  const totalFlowM3s = flowM3s * (1 + inputs.mixRatio);
  return { heatW, flowM3s, deltaTEffC, totalFlowM3s };
}

/** Plume decay length L (m). */
export function decayLengthM(totalFlowM3s: number): number {
  return LREF_M * Math.sqrt(totalFlowM3s / QREF_M3S);
}

/** Excess temperature (°C) at distance r (m) from the outfall. */
export function excessC(distanceM: number, deltaTEffC: number, totalFlowM3s: number): number {
  const L = decayLengthM(totalFlowM3s);
  return deltaTEffC * Math.exp(-distanceM / L);
}

/** Radius (m) at which excess falls to NEGLIGIBLE_C; 0 if already negligible at source. */
export function reachM(deltaTEffC: number, totalFlowM3s: number): number {
  if (deltaTEffC <= NEGLIGIBLE_C) return 0;
  const L = decayLengthM(totalFlowM3s);
  return L * Math.log(deltaTEffC / NEGLIGIBLE_C);
}
