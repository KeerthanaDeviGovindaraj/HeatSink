import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  FETCHED_AT_UNAVAILABLE,
  formatFetchedAt,
} from '../../src/components/formatFetchedAt';

describe('formatFetchedAt (R1.6)', () => {
  it('formats an ISO timestamp as a stable readable UTC string', () => {
    expect(formatFetchedAt('2026-10-24T17:46:31.126Z')).toBe('Oct 24, 2026, 17:46 UTC');
  });

  it('zero-pads single-digit hours, minutes, and renders the right month', () => {
    expect(formatFetchedAt('2024-08-01T04:05:00.000Z')).toBe('Aug 1, 2024, 04:05 UTC');
    expect(formatFetchedAt('2024-01-09T00:00:00.000Z')).toBe('Jan 9, 2024, 00:00 UTC');
    expect(formatFetchedAt('2024-12-31T23:59:00.000Z')).toBe('Dec 31, 2024, 23:59 UTC');
  });

  it('returns "unavailable" for null, undefined, empty, or unparseable input', () => {
    expect(formatFetchedAt(null)).toBe(FETCHED_AT_UNAVAILABLE);
    expect(formatFetchedAt(undefined)).toBe(FETCHED_AT_UNAVAILABLE);
    expect(formatFetchedAt('')).toBe(FETCHED_AT_UNAVAILABLE);
    expect(formatFetchedAt('not-a-date')).toBe(FETCHED_AT_UNAVAILABLE);
  });

  it('never returns "Invalid Date" and always ends in UTC for valid timestamps', () => {
    fc.assert(
      fc.property(
        // Valid epoch millis within a sane range, formatted back to ISO.
        fc.integer({ min: 0, max: 4_102_444_800_000 }),
        (ms) => {
          const out = formatFetchedAt(new Date(ms).toISOString());
          expect(out).not.toBe(FETCHED_AT_UNAVAILABLE);
          expect(out).not.toContain('Invalid');
          expect(out.endsWith(' UTC')).toBe(true);
        },
      ),
    );
  });
});
