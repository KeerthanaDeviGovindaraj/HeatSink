/**
 * Shared types for the thermal screening model.
 * Numeric names carry unit suffixes (tech.md). Missing values are null, never 0.
 */

/** Typed error for invalid model inputs (UI prevents these via bounded controls). */
export class InvalidInputError extends Error {
  constructor(
    message: string,
    readonly field: string,
  ) {
    super(message);
    this.name = 'InvalidInputError';
  }
}

/** Geographic point (WGS84). */
export interface LatLng {
  latDeg: number;
  lonDeg: number;
}

/** User-controlled inputs for a hypothetical site. */
export interface SiteInputs {
  outfall: LatLng;
  facilityMW: number;
  deltaTC: number;
  mixRatio: number;
  heatFraction: number;
}

/** Derived heat/flow quantities for a site. */
export interface FlowResult {
  heatW: number;
  flowM3s: number;
  deltaTEffC: number;
  totalFlowM3s: number;
}

/** One sample point on the fine grid. */
export interface SamplePoint {
  location: LatLng;
  distanceM: number;
  /** FIShBOT baseline bottom temperature (°C), or null when no cell covers the point. */
  baselineC: number | null;
  /** Depth (m) of the containing cell, or null when unknown. */
  depthM: number | null;
  excessC: number;
  bottomExcessC: number;
  /** Combined temperature (°C), or null when baseline is missing. */
  combinedC: number | null;
  /** True when the point is in deep water so only the surface is affected. */
  deepSurfaceOnly: boolean;
}

/** Per-species area and score outcome. */
export interface SpeciesResult {
  speciesId: string;
  thresholdC: number;
  newlyExceededKm2: number;
  alreadyExceededKm2: number;
  score: number;
  level: 'Low' | 'Medium' | 'High' | 'Insufficient data';
}

/** Full screening result for one site. */
export interface SiteResult {
  inputs: SiteInputs;
  flow: FlowResult;
  reachM: number;
  plumeAreaKm2: number;
  coverage: number;
  species: SpeciesResult[];
}

/** A baseline grid cell (e.g. FIShBOT ~7 km cell). */
export interface BaselineCell {
  center: LatLng;
  baselineC: number | null;
  depthM: number | null;
}
