/**
 * Runtime validators for snapshot JSON. Pure functions; throw on malformed data.
 * Only species with a non-empty source are usable (species.json rule).
 */
import type {
  DropReason,
  DroppedRow,
  OceanRow,
  RawOceanRow,
  SnapshotMeta,
  SpeciesEntry,
  SpeciesFile,
  ValidationResult,
} from './types';

/** Plausible seawater temperature band; rows outside are dropped (R2.2). */
export const TEMP_MIN_C = -2;
export const TEMP_MAX_C = 35;

/** MA coastal bounding box (ocean-data.md "Confirmed URLs"). */
export const MA_BOX = {
  latMin: 41.2,
  latMax: 43.0,
  lonMin: -71.2,
  lonMax: -69.8,
} as const;

/** Source sentinels that mean "no value" and MUST become null, never 0 (R2.3). */
const MISSING_SENTINELS = new Set(['', 'mm', 'nan', 'na', 'null', 'n/a']);

/** A species is usable only if it has a cited, verified, numeric threshold. */
export function isUsableSpecies(entry: SpeciesEntry): boolean {
  return (
    entry.verified &&
    entry.source.trim().length > 0 &&
    typeof entry.thresholdC === 'number' &&
    Number.isFinite(entry.thresholdC)
  );
}

/** Return only the species entries safe to show and score. */
export function usableSpecies(file: SpeciesFile): SpeciesEntry[] {
  return file.species.filter(isUsableSpecies);
}

/**
 * Normalize a raw cell to a finite number or null. Sentinels ("MM", "", "NaN")
 * and non-finite values become null; they are NEVER coerced to 0 (R2.3).
 */
export function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (MISSING_SENTINELS.has(trimmed.toLowerCase())) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Parse a raw timestamp to a canonical ISO-8601 string, or null if unparseable.
 * Accepts ISO strings and epoch-millisecond numbers; sentinels/empties fail.
 */
export function toIsoTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

/** True if `value` parses to a valid ISO/epoch timestamp. */
export function isValidTimestamp(value: unknown): boolean {
  return toIsoTimestamp(value) !== null;
}

/** True if a coordinate pair falls inside the MA coastal box (inclusive). */
export function inMaBox(lat: number, lon: number): boolean {
  return (
    lat >= MA_BOX.latMin &&
    lat <= MA_BOX.latMax &&
    lon >= MA_BOX.lonMin &&
    lon <= MA_BOX.lonMax
  );
}

/**
 * Classify a single raw row: return the normalized row when it passes every
 * bounds check, or the reason it must be dropped (R2.2, R2.3). Pure.
 */
function classifyRow(raw: RawOceanRow): OceanRow | DropReason {
  const time = toIsoTimestamp(raw.time);
  if (time === null) return 'bad-timestamp';

  const lat = toNumberOrNull(raw.lat);
  const lon = toNumberOrNull(raw.lon);
  if (lat === null || lon === null || !inMaBox(lat, lon)) {
    return 'coords-out-of-box';
  }

  const tempC = toNumberOrNull(raw.tempC);
  if (tempC === null) return 'missing-temp';
  if (tempC < TEMP_MIN_C || tempC > TEMP_MAX_C) return 'temp-out-of-range';

  return {
    time,
    lat,
    lon,
    tempC,
    depthM: toNumberOrNull(raw.depthM),
    nObs: toNumberOrNull(raw.nObs),
  };
}

/**
 * Validate a batch of raw rows into a snapshot. Keeps in-bounds rows, drops
 * out-of-bounds rows with a recorded reason, and guarantees
 * meta.rowCount + meta.droppedCount === input.length (R2.2, R10.2/P17).
 *
 * Throws only on malformed structural input (not an array of objects).
 */
export function validateOceanRows(
  raw: readonly RawOceanRow[],
  meta: Omit<SnapshotMeta, 'rowCount' | 'droppedCount'>,
): ValidationResult {
  if (!Array.isArray(raw)) {
    throw new TypeError('validateOceanRows: expected an array of rows');
  }

  const rows: OceanRow[] = [];
  const dropped: DroppedRow[] = [];

  for (const row of raw) {
    if (row === null || typeof row !== 'object') {
      throw new TypeError('validateOceanRows: every row must be an object');
    }
    const result = classifyRow(row);
    if (typeof result === 'string') {
      dropped.push({ row, reason: result });
    } else {
      rows.push(result);
    }
  }

  return {
    snapshot: {
      meta: { ...meta, rowCount: rows.length, droppedCount: dropped.length },
      rows,
    },
    dropped,
  };
}
