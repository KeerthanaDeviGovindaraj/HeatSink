/**
 * Browser-side loaders. The browser reads ONLY /public/data/*.json at runtime (tech.md).
 * Fetch + validate wiring is completed in a later task.
 */
import type { FeatureCollection } from 'geojson';
import type { BaselineCell } from '../model/types';
import type {
  DiadromousFile,
  OceanRow,
  Snapshot,
  SpeciesFile,
  Station,
} from './types';

const DATA_BASE = '/data';

/**
 * Adapt a committed FIShBOT {@link OceanRow} to a model {@link BaselineCell}.
 *
 * The snapshot rows have no stable id, so one is synthesized from the row index
 * (`fb-<index>`), and a null `nObs` collapses to 0 (the model treats nObs as a
 * plain count). `tempC` and `depthM` are passed through, preserving null for
 * missing values (never coerced to 0). Pure and deterministic.
 *
 * @param row A validated ocean observation row.
 * @param index The row's position in the snapshot, used to synthesize the id.
 * @returns The equivalent baseline cell the model consumes.
 */
export function oceanRowToBaselineCell(
  row: OceanRow,
  index: number,
): BaselineCell {
  return {
    id: `fb-${index}`,
    lat: row.lat,
    lon: row.lon,
    tempC: row.tempC ?? null,
    nObs: row.nObs ?? 0,
    depthM: row.depthM ?? null,
  };
}

/** Adapt every row of a FIShBOT snapshot to model {@link BaselineCell}s. */
export function baselineCellsFromSnapshot(
  snapshot: Snapshot<OceanRow>,
): BaselineCell[] {
  return snapshot.rows.map(oceanRowToBaselineCell);
}

/**
 * Fetch and parse the committed Massachusetts land mask (R3.2, R4.1).
 *
 * The browser reads only /public/data at runtime (tech.md); `ma-land.geojson`
 * is the simplified Natural Earth MA polygons the model uses to reject on-land
 * outfalls (`isOutfallOnLand`) and discard land sample points. Returns the raw
 * {@link FeatureCollection} so callers can pass it straight to the model.
 */
export async function loadLandMask(): Promise<FeatureCollection> {
  const res = await fetch(`${DATA_BASE}/ma-land.geojson`);
  if (!res.ok) throw new Error(`Failed to load ma-land.geojson: ${res.status}`);
  return (await res.json()) as FeatureCollection;
}

/** Fetch and parse species.json. */
export async function loadSpecies(): Promise<SpeciesFile> {
  const res = await fetch(`${DATA_BASE}/species.json`);
  if (!res.ok) throw new Error(`Failed to load species.json: ${res.status}`);
  return (await res.json()) as SpeciesFile;
}

/** A finite number guard used to drop malformed station coordinates. */
function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Fetch and parse the committed diadromous fish sampling stations
 * (stretch R9, public/data/diadromous.json, MassGIS/DMF).
 *
 * This loader DEGRADES GRACEFULLY: a 404, a parse failure, a non-array
 * `stations`, or any station missing finite lat/lon yields an empty list (or
 * drops just the bad station) rather than throwing. A missing or broken
 * diadromous file must never blank the map — the river-mouth flag is an
 * optional overlay (R9 "WHEN enabled").
 *
 * @returns The validated station list, or [] when the file is absent/invalid.
 */
export async function loadDiadromous(): Promise<Station[]> {
  try {
    const res = await fetch(`${DATA_BASE}/diadromous.json`);
    if (!res.ok) return [];
    const file = (await res.json()) as DiadromousFile;
    if (!file || !Array.isArray(file.stations)) return [];
    return file.stations.filter(
      (s): s is Station =>
        !!s &&
        typeof s.id === 'string' &&
        typeof s.name === 'string' &&
        isFiniteNumber(s.lat) &&
        isFiniteNumber(s.lon),
    );
  } catch {
    return [];
  }
}

/**
 * Fetch and parse one committed ocean snapshot file from /public/data.
 * Returns the full {@link Snapshot} so the caller has the meta block
 * (source, url, fetchedAt, window) for the Footer (R1.6).
 */
async function loadSnapshot(file: string): Promise<Snapshot<OceanRow>> {
  const res = await fetch(`${DATA_BASE}/${file}`);
  if (!res.ok) throw new Error(`Failed to load ${file}: ${res.status}`);
  return (await res.json()) as Snapshot<OceanRow>;
}

/**
 * Fetch and parse the committed FIShBOT baseline snapshot (R1.1).
 * Returns the full Snapshot so the caller has the meta block (window, fetchedAt).
 */
export function loadFishbot(): Promise<Snapshot<OceanRow>> {
  return loadSnapshot('fishbot.json');
}

/**
 * Fetch and parse the committed eMOLT snapshot. Returns the full Snapshot so the
 * Footer can show the source and `fetchedAt` (R1.6).
 */
export function loadEmolt(): Promise<Snapshot<OceanRow>> {
  return loadSnapshot('emolt.json');
}

/**
 * Fetch and parse the committed NDBC buoy snapshot. Returns the full Snapshot so
 * the Footer can show the source and `fetchedAt` (R1.6).
 */
export function loadNdbc(): Promise<Snapshot<OceanRow>> {
  return loadSnapshot('ndbc.json');
}
