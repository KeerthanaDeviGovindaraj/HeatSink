// src/model/types.ts — create and push FIRST (spec task 2.0, design.md).
// Person B builds the UI against these interfaces; do not change shapes without coordinating.

export interface SiteInputs {
  lat: number;
  lon: number;
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

export interface ThermalResult {
  heatW: number;
  flowM3s: number;
  flowMGD: number;
  totalFlowM3s: number;
  deltaTEffC: number;
  decayLengthM: number;
  reachM: number;
}

export interface BaselineCell {
  id: string;
  lat: number;
  lon: number;
  tempC: number | null;
  nObs: number;
  depthM: number | null;
}

export interface SamplePoint {
  lat: number;
  lon: number;
  distanceM: number;
  baselineC: number | null;
  depthM: number | null;
}

export interface PointImpact extends SamplePoint {
  excessC: number;
  bottomExcessC: number;
  combinedC: number | null;
  deepSurfaceOnly: boolean;
}

export interface Species {
  id: string;
  name: string;
  thresholdC: number;
  source: string;
  verified: boolean;
}

export type Level = 'Low' | 'Medium' | 'High' | 'Insufficient data';

export interface SpeciesRisk {
  speciesId: string;
  newlyExceededKm2: number;
  alreadyExceededKm2: number;
  score: number;
  level: Level;
}

export interface SiteResult {
  inputs: SiteInputs;
  thermal: ThermalResult;
  points: PointImpact[];
  plumeAreaKm2: number;
  coverage: number;
  risks: SpeciesRisk[];
}

export class InputRangeError extends Error {}
export class OutfallOnLandError extends Error {}
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
