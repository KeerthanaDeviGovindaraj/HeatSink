/**
 * Browser-side loaders. The browser reads ONLY /public/data/*.json at runtime (tech.md).
 * Fetch + validate wiring is completed in a later task.
 */
import type { BaselineCell } from '../model/types';
import type { OceanRow, Snapshot, SpeciesFile } from './types';

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

/** Fetch and parse species.json. */
export async function loadSpecies(): Promise<SpeciesFile> {
  const res = await fetch(`${DATA_BASE}/species.json`);
  if (!res.ok) throw new Error(`Failed to load species.json: ${res.status}`);
  return (await res.json()) as SpeciesFile;
}

/**
 * Fetch and parse the committed FIShBOT baseline snapshot (R1.1).
 * Returns the full Snapshot so the caller has the meta block (window, fetchedAt).
 */
export async function loadFishbot(): Promise<Snapshot<OceanRow>> {
  const res = await fetch(`${DATA_BASE}/fishbot.json`);
  if (!res.ok) throw new Error(`Failed to load fishbot.json: ${res.status}`);
  return (await res.json()) as Snapshot<OceanRow>;
}
