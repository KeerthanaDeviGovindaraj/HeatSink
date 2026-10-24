/**
 * Unit conversions. Pure, deterministic, no I/O.
 */
import { MGD_PER_M3S } from './constants';

/** Convert volumetric flow from m³/s to million US gallons per day. */
export function toMGD(flowM3s: number): number {
  return flowM3s * MGD_PER_M3S;
}

/** Convert volumetric flow from million US gallons per day to m³/s. */
export function fromMGD(flowMGD: number): number {
  return flowMGD / MGD_PER_M3S;
}
