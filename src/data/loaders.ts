/**
 * Browser-side loaders. The browser reads ONLY /public/data/*.json at runtime (tech.md).
 * Fetch + validate wiring is completed in a later task.
 */
import type { OceanRow, Snapshot, SpeciesFile } from './types';

const DATA_BASE = '/data';

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
