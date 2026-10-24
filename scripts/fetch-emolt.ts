/**
 * eMOLT measured bottom-temperature boat points (hourly).
 * These are individual measured points — NOT aggregated into a trend. The kit
 * slice is one week (Aug 2024), so we must not present a warming trend from it
 * (R2.5). Writes a Snapshot<OceanRow> with a meta block to public/data/emolt.json.
 *
 * Live source: eMOLT ERDDAP tabledap, dataset eMOLT_RT (QC/QA applied).
 * Cite the eMOLT program and the contributing fishing vessels. See ocean-data.md.
 *
 * Fallback order so `npm run data` never crashes and the offline demo keeps
 * working (tech.md: browser reads only /public/data/*.json):
 *   1. live ERDDAP fetch (JSON) → validate → write
 *   2. committed kit file (public/data/kit/emolt*.{json,csv}) → validate → write
 *   3. keep the existing committed public/data/emolt.json if present
 *   4. write an empty-but-valid snapshot so loaders still succeed
 *
 * Runs under Node (tsx), not the browser; node:fs/node:path are fine here.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateOceanRows } from '../src/data/validators';
import type {
  OceanRow,
  RawOceanRow,
  Snapshot,
  SnapshotMeta,
} from '../src/data/types';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(SCRIPT_DIR, '..');
const DATA_DIR = join(PROJECT_ROOT, 'public', 'data');
const KIT_DIR = join(DATA_DIR, 'kit');
const OUT_FILE = join(DATA_DIR, 'emolt.json');

const SOURCE =
  'eMOLT (eMOLT program + contributing fishing vessels; eMOLT ERDDAP)';
/** Kit's one-week Aug 2024 slice (ocean-data.md "Confirmed URLs"). No trend from it (R2.5). */
const WINDOW = '2024-08-01/2024-08-08';

/** MA coastal box + Aug-2024 window, ERDDAP operators URL-encoded (ocean-data.md). */
const QUERY_URL =
  'https://erddap.emolt.net/erddap/tabledap/eMOLT_RT.json' +
  '?time,latitude,longitude,depth,temperature' +
  '&time%3E=2024-08-01T00:00:00Z&time%3C=2024-08-08T00:00:00Z' +
  '&latitude%3E=41.2&latitude%3C=43.0' +
  '&longitude%3E=-71.2&longitude%3C=-69.8';

/** ERDDAP tabledap JSON payload shape. */
interface ErddapTable {
  table?: {
    columnNames?: string[];
    rows?: unknown[][];
  };
}

/**
 * Convert an ERDDAP tabledap JSON table into loosely-typed raw rows mapped to
 * the OceanRow field names the validator understands. eMOLT returns individual
 * measured points: tempC←temperature, depthM←depth, nObs=null (not aggregated).
 */
function erddapJsonToRaw(json: ErddapTable): RawOceanRow[] {
  const columnNames = json.table?.columnNames;
  const rows = json.table?.rows;
  if (!Array.isArray(columnNames) || !Array.isArray(rows)) return [];

  const idx = {
    time: columnNames.indexOf('time'),
    lat: columnNames.indexOf('latitude'),
    lon: columnNames.indexOf('longitude'),
    depth: columnNames.indexOf('depth'),
    temp: columnNames.indexOf('temperature'),
  };

  return rows.map((cells) => ({
    time: idx.time >= 0 ? cells[idx.time] : undefined,
    lat: idx.lat >= 0 ? cells[idx.lat] : undefined,
    lon: idx.lon >= 0 ? cells[idx.lon] : undefined,
    tempC: idx.temp >= 0 ? cells[idx.temp] : undefined,
    depthM: idx.depth >= 0 ? cells[idx.depth] : undefined,
    nObs: null,
  }));
}

/** Split one CSV line, honoring simple double-quoted fields. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out;
}

/**
 * Parse ERDDAP CSV text (header row of column names, optional units row) into
 * raw rows. ERDDAP CSV puts column names on line 1 and units on line 2.
 */
function erddapCsvToRaw(csv: string): RawOceanRow[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const header = splitCsvLine(lines[0]).map((h) => h.trim());
  const idx = {
    time: header.indexOf('time'),
    lat: header.indexOf('latitude'),
    lon: header.indexOf('longitude'),
    depth: header.indexOf('depth'),
    temp: header.indexOf('temperature'),
  };

  // ERDDAP emits a units row right after the header; skip it if present.
  let start = 1;
  if (lines.length > 1) {
    const second = splitCsvLine(lines[1]);
    const looksLikeUnits =
      idx.lat >= 0 && Number.isNaN(Number((second[idx.lat] ?? '').trim()));
    if (looksLikeUnits) start = 2;
  }

  const rows: RawOceanRow[] = [];
  for (let i = start; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i]);
    rows.push({
      time: idx.time >= 0 ? cells[idx.time] : undefined,
      lat: idx.lat >= 0 ? cells[idx.lat] : undefined,
      lon: idx.lon >= 0 ? cells[idx.lon] : undefined,
      tempC: idx.temp >= 0 ? cells[idx.temp] : undefined,
      depthM: idx.depth >= 0 ? cells[idx.depth] : undefined,
      nObs: null,
    });
  }
  return rows;
}

/** Try the live ERDDAP endpoint. Returns raw rows or null on any failure. */
async function fetchLive(): Promise<RawOceanRow[] | null> {
  try {
    const res = await fetch(QUERY_URL, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      console.log(`  [emolt] live fetch returned HTTP ${res.status}.`);
      return null;
    }
    const json = (await res.json()) as ErddapTable;
    const raw = erddapJsonToRaw(json);
    if (raw.length === 0) {
      console.log('  [emolt] live fetch returned no rows.');
      return null;
    }
    return raw;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  [emolt] live fetch failed: ${msg}`);
    return null;
  }
}

/** Look for a committed kit file (JSON or CSV) and parse it to raw rows. */
function readKitFile(): RawOceanRow[] | null {
  if (!existsSync(KIT_DIR)) return null;
  let names: string[];
  try {
    names = readdirSync(KIT_DIR);
  } catch {
    return null;
  }
  const match = names.find(
    (n) => /emolt/i.test(n) && /\.(json|csv)$/i.test(n),
  );
  if (!match) return null;

  const path = join(KIT_DIR, match);
  try {
    const text = readFileSync(path, 'utf8');
    if (/\.json$/i.test(match)) {
      const parsed = JSON.parse(text) as unknown;
      // Accept either an ERDDAP table or an array of raw rows.
      if (parsed && typeof parsed === 'object' && 'table' in parsed) {
        const raw = erddapJsonToRaw(parsed as ErddapTable);
        return raw.length > 0 ? raw : null;
      }
      if (Array.isArray(parsed)) return parsed as RawOceanRow[];
      return null;
    }
    const raw = erddapCsvToRaw(text);
    return raw.length > 0 ? raw : null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  [emolt] kit file ${match} unreadable: ${msg}`);
    return null;
  }
}

/** True if the existing committed snapshot is structurally valid. */
function existingSnapshotIsValid(): boolean {
  if (!existsSync(OUT_FILE)) return false;
  try {
    const parsed = JSON.parse(readFileSync(OUT_FILE, 'utf8')) as Partial<
      Snapshot<OceanRow>
    >;
    return (
      parsed != null &&
      typeof parsed === 'object' &&
      parsed.meta != null &&
      Array.isArray(parsed.rows)
    );
  } catch {
    return false;
  }
}

/**
 * Build a snapshot from raw rows and write it to disk. eMOLT rows are measured
 * points kept as-is (no per-cell aggregation, no trend — R2.5); the validator
 * guarantees rowCount + droppedCount === raw.length.
 */
function writeSnapshot(
  raw: RawOceanRow[],
  meta: Omit<SnapshotMeta, 'rowCount' | 'droppedCount'>,
): Snapshot<OceanRow> {
  const { snapshot } = validateOceanRows(raw, meta);
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(OUT_FILE, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  return snapshot;
}

export async function fetchEmolt(): Promise<void> {
  const meta: Omit<SnapshotMeta, 'rowCount' | 'droppedCount'> = {
    source: SOURCE,
    url: QUERY_URL,
    fetchedAt: new Date().toISOString(),
    window: WINDOW,
  };

  // 1. Live ERDDAP refresh.
  const live = await fetchLive();
  if (live) {
    const snap = writeSnapshot(live, meta);
    console.log(
      `  [emolt] live refresh OK — ${snap.meta.rowCount} points, ` +
        `${snap.meta.droppedCount} rows dropped → public/data/emolt.json`,
    );
    return;
  }

  // 2. Committed kit file fallback.
  const kit = readKitFile();
  if (kit) {
    const snap = writeSnapshot(kit, {
      ...meta,
      url: `kit:${QUERY_URL}`,
    });
    console.log(
      `  [emolt] used committed kit file — ${snap.meta.rowCount} points, ` +
        `${snap.meta.droppedCount} rows dropped → public/data/emolt.json`,
    );
    return;
  }

  // 3. Keep the existing committed snapshot if it is valid.
  if (existingSnapshotIsValid()) {
    console.log(
      '  [emolt] live fetch and kit file unavailable — keeping existing ' +
        'committed public/data/emolt.json (offline demo).',
    );
    return;
  }

  // 4. Last resort: write an empty-but-valid snapshot so loaders still succeed.
  const snap = writeSnapshot([], meta);
  console.log(
    '  [emolt] no live data, no kit file, no prior snapshot — wrote an ' +
      `empty valid snapshot (${snap.meta.rowCount} rows) so the demo still loads.`,
  );
}
