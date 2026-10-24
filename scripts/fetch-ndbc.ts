/**
 * NOAA NDBC buoy 44013 surface water temperature context near Boston.
 * Parses the standard realtime2 fixed/space-delimited text feed. Missing values
 * ("MM") become null and such rows are dropped — WTMP is NEVER coerced to 0 (R2.3).
 * Writes a Snapshot<OceanRow> with a meta block to public/data/ndbc.json.
 *
 * Live source: https://www.ndbc.noaa.gov/data/realtime2/44013.txt (see ocean-data.md).
 * Cite NOAA NDBC.
 *
 * Fallback order so `npm run data` never crashes and the offline demo keeps
 * working (tech.md: browser reads only /public/data/*.json):
 *   1. live realtime2 text fetch → parse → validate → write
 *   2. committed kit file (public/data/kit/ndbc*.{txt,json,csv}) → parse → write
 *   3. keep the existing committed public/data/ndbc.json if present
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
const OUT_FILE = join(DATA_DIR, 'ndbc.json');

const SOURCE = 'NOAA NDBC buoy 44013';
const FEED_URL = 'https://www.ndbc.noaa.gov/data/realtime2/44013.txt';

/**
 * Fixed position of buoy 44013 (Boston Approach Lighted Buoy, ~16 NM E of
 * Boston). Recorded here so every row carries the buoy coordinates and the
 * validator keeps them inside the MA coastal box.
 */
const BUOY_44013 = { lat: 42.346, lon: -70.651 } as const;

/** NDBC sentinel for a missing cell. Must become null, never 0 (R2.3). */
const NDBC_MISSING = 'MM';

/**
 * Parse the realtime2 standard meteorological text feed into raw rows.
 *
 * Format: two leading header lines beginning with '#'. The first names the
 * columns (`#YY MM DD hh mm ... WTMP ...`), the second gives units. Data rows
 * are whitespace-delimited. We locate the timestamp columns and WTMP by name,
 * build an ISO-8601 UTC timestamp from YY/MM/DD/hh/mm, and read WTMP (°C).
 * Rows whose WTMP is "MM" (no usable surface temperature) are skipped — WTMP
 * is never coerced to 0.
 */
function realtime2ToRaw(text: string): RawOceanRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headerLine = lines.find((l) => l.startsWith('#'));
  if (!headerLine) return [];

  // Column names with the leading '#' stripped from the first token.
  const header = headerLine.replace(/^#/, '').trim().split(/\s+/);
  const col = {
    yy: header.indexOf('YY'),
    mm: header.indexOf('MM'),
    dd: header.indexOf('DD'),
    hh: header.indexOf('hh'),
    mn: header.indexOf('mm'),
    wtmp: header.indexOf('WTMP'),
  };

  // Need the timestamp pieces and WTMP to produce a usable surface-temp row.
  if (
    col.yy < 0 ||
    col.mm < 0 ||
    col.dd < 0 ||
    col.hh < 0 ||
    col.mn < 0 ||
    col.wtmp < 0
  ) {
    return [];
  }

  const rows: RawOceanRow[] = [];
  for (const line of lines) {
    if (line.startsWith('#')) continue;
    const cells = line.trim().split(/\s+/);

    const wtmp = cells[col.wtmp];
    // No usable surface temperature → drop the row; never coerce MM to 0 (R2.3).
    if (wtmp === undefined || wtmp === NDBC_MISSING) continue;

    const yy = cells[col.yy];
    const mo = cells[col.mm];
    const dy = cells[col.dd];
    const hr = cells[col.hh];
    const mn = cells[col.mn];
    if (
      [yy, mo, dy, hr, mn].some(
        (c) => c === undefined || c === NDBC_MISSING,
      )
    ) {
      continue;
    }

    // NDBC realtime2 reports a 4-digit year; timestamps are UTC.
    const iso = `${yy}-${pad(mo)}-${pad(dy)}T${pad(hr)}:${pad(mn)}:00Z`;

    rows.push({
      time: iso,
      lat: BUOY_44013.lat,
      lon: BUOY_44013.lon,
      tempC: wtmp,
      depthM: null,
      nObs: null,
    });
  }
  return rows;
}

/** Left-pad a numeric string to two digits (e.g. "8" → "08"). */
function pad(value: string): string {
  return value.length >= 2 ? value : `0${value}`;
}

/** Summarize the actual time span covered by the kept rows, for meta.window. */
function windowOf(rows: readonly OceanRow[]): string {
  if (rows.length === 0) return 'none';
  let min = rows[0].time;
  let max = rows[0].time;
  for (const r of rows) {
    if (r.time < min) min = r.time;
    if (r.time > max) max = r.time;
  }
  return `${min}/${max}`;
}

/** Try the live realtime2 text feed. Returns raw rows or null on any failure. */
async function fetchLive(): Promise<RawOceanRow[] | null> {
  try {
    const res = await fetch(FEED_URL, { headers: { Accept: 'text/plain' } });
    if (!res.ok) {
      console.log(`  [ndbc] live fetch returned HTTP ${res.status}.`);
      return null;
    }
    const text = await res.text();
    const raw = realtime2ToRaw(text);
    if (raw.length === 0) {
      console.log('  [ndbc] live fetch returned no usable surface-temp rows.');
      return null;
    }
    return raw;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  [ndbc] live fetch failed: ${msg}`);
    return null;
  }
}

/** Look for a committed kit file (realtime2 text, JSON, or CSV) and parse it. */
function readKitFile(): RawOceanRow[] | null {
  if (!existsSync(KIT_DIR)) return null;
  let names: string[];
  try {
    names = readdirSync(KIT_DIR);
  } catch {
    return null;
  }
  const match = names.find(
    (n) =>
      (/ndbc/i.test(n) || /44013/i.test(n)) && /\.(txt|json|csv)$/i.test(n),
  );
  if (!match) return null;

  const path = join(KIT_DIR, match);
  try {
    const text = readFileSync(path, 'utf8');
    if (/\.json$/i.test(match)) {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) return parsed as RawOceanRow[];
      return null;
    }
    // Both the raw .txt feed and a saved .csv share the realtime2 layout.
    const raw = realtime2ToRaw(text);
    return raw.length > 0 ? raw : null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  [ndbc] kit file ${match} unreadable: ${msg}`);
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
 * Build a snapshot from raw rows and write it to disk. meta.window is set to
 * the actual time span of the kept rows. The validator guarantees
 * rowCount + droppedCount === raw.length.
 */
function writeSnapshot(
  raw: RawOceanRow[],
  meta: Omit<SnapshotMeta, 'rowCount' | 'droppedCount' | 'window'>,
): Snapshot<OceanRow> {
  const { snapshot } = validateOceanRows(raw, { ...meta, window: 'pending' });
  const finalSnapshot: Snapshot<OceanRow> = {
    ...snapshot,
    meta: { ...snapshot.meta, window: windowOf(snapshot.rows) },
  };
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(OUT_FILE, `${JSON.stringify(finalSnapshot, null, 2)}\n`, 'utf8');
  return finalSnapshot;
}

export async function fetchNdbc(): Promise<void> {
  const meta: Omit<SnapshotMeta, 'rowCount' | 'droppedCount' | 'window'> = {
    source: SOURCE,
    url: FEED_URL,
    fetchedAt: new Date().toISOString(),
  };

  // 1. Live realtime2 refresh.
  const live = await fetchLive();
  if (live) {
    const snap = writeSnapshot(live, meta);
    console.log(
      `  [ndbc] live refresh OK — ${snap.meta.rowCount} surface-temp rows, ` +
        `${snap.meta.droppedCount} rows dropped → public/data/ndbc.json`,
    );
    return;
  }

  // 2. Committed kit file fallback.
  const kit = readKitFile();
  if (kit) {
    const snap = writeSnapshot(kit, { ...meta, url: `kit:${FEED_URL}` });
    console.log(
      `  [ndbc] used committed kit file — ${snap.meta.rowCount} surface-temp ` +
        `rows, ${snap.meta.droppedCount} rows dropped → public/data/ndbc.json`,
    );
    return;
  }

  // 3. Keep the existing committed snapshot if it is valid.
  if (existingSnapshotIsValid()) {
    console.log(
      '  [ndbc] live fetch and kit file unavailable — keeping existing ' +
        'committed public/data/ndbc.json (offline demo).',
    );
    return;
  }

  // 4. Last resort: write an empty-but-valid snapshot so loaders still succeed.
  const snap = writeSnapshot([], meta);
  console.log(
    '  [ndbc] no live data, no kit file, no prior snapshot — wrote an ' +
      `empty valid snapshot (${snap.meta.rowCount} rows) so the demo still loads.`,
  );
}
