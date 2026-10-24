/**
 * Top-level orchestration: inputs + baseline data → full SiteResult. Pure, no I/O.
 * Implemented in a later task once grid/plume/risk are complete.
 */
import type { BaselineCell, SiteInputs, SiteResult } from './types';

/** Species threshold used for scoring (only cited, verified thresholds are passed in). */
export interface SpeciesThreshold {
  speciesId: string;
  thresholdC: number;
}

export function runSite(
  _inputs: SiteInputs,
  _cells: BaselineCell[],
  _landMask: GeoJSON.FeatureCollection,
  _species: SpeciesThreshold[],
): SiteResult {
  throw new Error('runSite not implemented yet');
}
