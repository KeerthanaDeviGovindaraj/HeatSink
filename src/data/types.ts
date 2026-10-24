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
