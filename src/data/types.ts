/**
 * Types for committed JSON snapshots the browser reads from /public/data.
 * Every snapshot carries a meta block (ocean-data.md). Missing values are null.
 */

/** Provenance block attached to every snapshot. */
export interface SnapshotMeta {
  source: string;
  url: string;
  fetchedAt: string;
  window: string;
  rowCount: number;
  droppedCount: number;
}

export interface Snapshot<T> {
  meta: SnapshotMeta;
  rows: T[];
}

/** One species entry from species.json. */
export interface SpeciesEntry {
  id: string;
  name: string;
  thresholdC: number | null;
  source: string;
  verified: boolean;
}

export interface SpeciesFile {
  _note?: string;
  species: SpeciesEntry[];
}

/**
 * One validated ocean observation row (FIShBOT / eMOLT / NDBC).
 * All numeric fields are already normalized: missing values are null, never 0.
 */
export interface OceanRow {
  time: string;
  lat: number;
  lon: number;
  tempC: number;
  depthM: number | null;
  nObs: number | null;
}

/**
 * A raw row as parsed from CSV/JSON before validation. Fields are loosely typed
 * because sources emit strings, numbers, sentinels ("MM"), or absent keys.
 */
export interface RawOceanRow {
  time?: unknown;
  lat?: unknown;
  lon?: unknown;
  tempC?: unknown;
  depthM?: unknown;
  nObs?: unknown;
}

/** Why a raw row was dropped during validation (R2.2). */
export type DropReason =
  | 'temp-out-of-range'
  | 'coords-out-of-box'
  | 'bad-timestamp'
  | 'missing-temp';

/** A dropped row paired with the reason it was rejected. */
export interface DroppedRow {
  row: RawOceanRow;
  reason: DropReason;
}

/** Result of validating a batch of raw rows into a snapshot. */
export interface ValidationResult {
  snapshot: Snapshot<OceanRow>;
  dropped: DroppedRow[];
}
