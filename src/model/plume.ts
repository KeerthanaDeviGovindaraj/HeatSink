/**
 * Apply the plume and shallow-water bottom-effect rules to sample points. Pure, no I/O.
 * Implemented in a later task (see thermal-model.md "Bottom effect").
 */
import type { FlowResult, SamplePoint } from './types';

/**
 * Populate excessC, bottomExcessC, combinedC, and deepSurfaceOnly for each point.
 * Implemented in a later task.
 */
export function applyPlume(_points: SamplePoint[], _flow: FlowResult): SamplePoint[] {
  throw new Error('applyPlume not implemented yet');
}
