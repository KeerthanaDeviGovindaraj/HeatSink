/**
 * Pure display helpers for the SiteEditor flow card (R3.5).
 *
 * These turn a {@link ThermalResult} into the three numbers the card shows —
 * heat to water (MW), required flow (m³/s and MGD) — plus the Brayton Point
 * scale fraction. Kept DOM-free and side-effect-free so they unit-test in a
 * node env (@testing-library/react is not installed).
 *
 * All numeric constants come from `constants.ts` (the "only place numbers live",
 * design.md); nothing is hard-coded here.
 */
import { BRAYTON_PEAK_MGD, W_PER_MW } from '../model/constants';
import type { ThermalResult } from '../model/types';

/** Heat delivered to the water, in megawatts (heatW is in watts). */
export function heatMW(result: ThermalResult): number {
  return result.heatW / W_PER_MW;
}

/**
 * The site's required cooling flow as a fraction of the Brayton Point reference
 * (~1 billion gal/day = {@link BRAYTON_PEAK_MGD} MGD), clamped to [0, 1] so the
 * scale bar never overflows. A value of 1 means "at or above the reference".
 */
export function braytonFraction(flowMGD: number): number {
  if (!Number.isFinite(flowMGD) || flowMGD <= 0) return 0;
  const fraction = flowMGD / BRAYTON_PEAK_MGD;
  return fraction > 1 ? 1 : fraction;
}

/** Round to `digits` decimal places for tidy display. */
export function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Format heat to water as e.g. "79 MW". */
export function formatHeatMW(result: ThermalResult): string {
  return `${roundTo(heatMW(result), 0)} MW`;
}

/** Format required flow in m³/s as e.g. "3.87 m³/s". */
export function formatFlowM3s(result: ThermalResult): string {
  return `${roundTo(result.flowM3s, 2)} m³/s`;
}

/** Format required flow in MGD as e.g. "88 MGD". */
export function formatFlowMGD(result: ThermalResult): string {
  return `${roundTo(result.flowMGD, 1)} MGD`;
}

/** Format the Brayton fraction as a whole-percent string, e.g. "9%". */
export function formatBraytonPercent(flowMGD: number): string {
  return `${roundTo(braytonFraction(flowMGD) * 100, 0)}%`;
}
