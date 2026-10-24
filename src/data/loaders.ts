/**
 * Browser-side loaders. The browser reads ONLY /public/data/*.json at runtime (tech.md).
 * Fetch + validate wiring is completed in a later task.
 */
import type { SpeciesFile } from './types';

const DATA_BASE = '/data';

/** Fetch and parse species.json. */
export async function loadSpecies(): Promise<SpeciesFile> {
  const res = await fetch(`${DATA_BASE}/species.json`);
  if (!res.ok) throw new Error(`Failed to load species.json: ${res.status}`);
  return (await res.json()) as SpeciesFile;
}
