/**
 * Pure formatting for snapshot `fetchedAt` timestamps shown in the Footer (R1.6).
 *
 * Snapshots store `fetchedAt` as an ISO-8601 string. The Footer wants a
 * human-readable form, but `toLocaleString()` output varies by host locale and
 * timezone, which makes it awkward to assert in tests. So we format in UTC with
 * a fixed, stable shape ("Oct 24, 2026, 17:46 UTC") that reads cleanly at phone
 * width and is deterministic. A missing or unparseable timestamp returns a
 * sentinel the Footer renders as "unavailable".
 *
 * No DOM, no I/O — safe to unit-test in a node env.
 */

/** Returned when a timestamp is absent or cannot be parsed. */
export const FETCHED_AT_UNAVAILABLE = 'unavailable';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/** Zero-pad a number to two digits. */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Format an ISO-8601 timestamp as a stable, readable UTC string for the Footer
 * (R1.6). Returns {@link FETCHED_AT_UNAVAILABLE} for null/undefined/empty or an
 * unparseable value so the source can be shown as "unavailable" rather than
 * crashing or printing "Invalid Date".
 *
 * @param iso An ISO-8601 timestamp (e.g. "2026-10-24T17:46:31.126Z").
 * @returns e.g. "Oct 24, 2026, 17:46 UTC", or "unavailable".
 */
export function formatFetchedAt(iso: string | null | undefined): string {
  if (iso == null || iso === '') return FETCHED_AT_UNAVAILABLE;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return FETCHED_AT_UNAVAILABLE;
  const month = MONTHS[d.getUTCMonth()];
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();
  const hh = pad2(d.getUTCHours());
  const mm = pad2(d.getUTCMinutes());
  return `${month} ${day}, ${year}, ${hh}:${mm} UTC`;
}
