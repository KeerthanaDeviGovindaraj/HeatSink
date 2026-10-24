// src/model/types.ts — create and push FIRST (spec task 2.0, design.md).
// Person B builds the UI against these interfaces; do not change shapes without coordinating.
//
// Shared types for the thermal screening model (satisfies Requirement R10).
// Numeric names carry unit suffixes (tech.md). Missing values are null, never 0.

export interface SiteInputs {
  lat: number;
  lon: number;
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
