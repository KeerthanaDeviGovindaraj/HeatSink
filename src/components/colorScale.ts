/**
 * Pure color-scale and legend helpers for the baseline temperature map (R1.2, R1.4).
 *
 * Ramp: ColorBrewer "YlGnBu" 6-class sequential — colorblind-safe and
 * perceptually ordered (light/yellow = cold, dark/blue = warm). Hard-coded here
 * so the map needs no extra dependency. Low °C maps to the light end and high °C
 * to the dark end, giving a monotonic cold→warm mapping.
 *
 * No I/O; safe to unit-test without a DOM.
 */
import { cToF } from '../model/units';

/** Distinct style for cells with no temperature reading (R1.4). Never color-filled. */
export const NO_DATA_COLOR = '#9e9e9e';

/** Temperature domain (°C) the ramp spans. Covers the committed FIShBOT snapshot. */
export const TEMP_MIN_C = 4;
export const TEMP_MAX_C = 24;

/**
 * YlGnBu sequential stops from cold (light) to warm (dark).
 * Each stop is the upper °C bound for that color band; the last band is open-ended.
 */
interface RampStop {
  /** Upper °C bound for this band (inclusive). */
  maxC: number;
  color: string;
}

const RAMP: readonly RampStop[] = [
  { maxC: 7, color: '#ffffcc' },
  { maxC: 10, color: '#c7e9b4' },
  { maxC: 13, color: '#7fcdbb' },
  { maxC: 16, color: '#41b6c4' },
  { maxC: 19, color: '#2c7fb8' },
  { maxC: Infinity, color: '#253494' },
] as const;

/**
 * Map a temperature (°C) to a colorblind-safe fill color.
 * Returns the no-data sentinel color for null/undefined/NaN so missing cells are
 * never colored as if they were a real (e.g. 0 °C) reading (R1.4).
 */
export function colorForTemp(tempC: number | null | undefined): string {
  if (tempC == null || Number.isNaN(tempC)) return NO_DATA_COLOR;
  for (const stop of RAMP) {
    if (tempC <= stop.maxC) return stop.color;
  }
  // Unreachable: last band is open-ended, but keep the ramp total.
  return RAMP[RAMP.length - 1].color;
}

/** True when a reading has no usable temperature and must use no-data styling (R1.4). */
export function isNoData(tempC: number | null | undefined): boolean {
  return tempC == null || Number.isNaN(tempC);
}

export interface LegendStop {
  /** Lower °C bound for the band. */
  fromC: number;
  /** Upper °C bound for the band, or null when open-ended. */
  toC: number | null;
  color: string;
  /** Lower bound in °F (via cToF), rounded for display. */
  fromF: number;
  /** Upper bound in °F, or null when open-ended. */
  toF: number | null;
}

/**
 * Build legend stops showing each color band with both °C and °F bounds (R1.2).
 * °F is derived from °C with cToF so the two scales always agree.
 */
export function legendStops(): LegendStop[] {
  const stops: LegendStop[] = [];
  let fromC = -Infinity;
  for (const stop of RAMP) {
    const toC = Number.isFinite(stop.maxC) ? stop.maxC : null;
    stops.push({
      fromC,
      toC,
      color: stop.color,
      fromF: Number.isFinite(fromC) ? round1(cToF(fromC)) : -Infinity,
      toF: toC == null ? null : round1(cToF(toC)),
    });
    fromC = stop.maxC;
  }
  return stops;
}

/** Round to one decimal place for tidy legend/tooltip display. */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Format a temperature as "12.3 °C (54.1 °F)", or an em dash for no data (R1.5). */
export function formatTemp(tempC: number | null | undefined): string {
  if (isNoData(tempC)) return '—';
  const c = tempC as number;
  return `${round1(c)} °C (${round1(cToF(c))} °F)`;
}

/** Format an optional numeric field; null/undefined → em dash, never 0 (R1.5). */
export function formatOptional(value: number | null | undefined, suffix = ''): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value}${suffix}`;
}
