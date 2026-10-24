import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  MA_BOX,
  TEMP_MAX_C,
  TEMP_MIN_C,
  inMaBox,
  isUsableSpecies,
  toNumberOrNull,
  validateOceanRows,
} from '../../src/data/validators';
import type { RawOceanRow, SpeciesEntry } from '../../src/data/types';

const META = {
  source: 'test',
  url: 'https://example.test',
  fetchedAt: '2024-08-08T00:00:00Z',
  window: '2024-08-01/2024-08-08',
};

describe('species validators', () => {
  // A species is hidden unless it is verified AND cited AND has a numeric threshold.
  it('only accepts verified, cited, numeric-threshold species', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string(),
          name: fc.string(),
          thresholdC: fc.option(fc.double({ noNaN: true }), { nil: null }),
          source: fc.string(),
          verified: fc.boolean(),
        }),
        (entry: SpeciesEntry) => {
          const usable = isUsableSpecies(entry);
          if (usable) {
            expect(entry.verified).toBe(true);
            expect(entry.source.trim().length).toBeGreaterThan(0);
            expect(typeof entry.thresholdC).toBe('number');
          }
        },
      ),
    );
  });

  it('hides the placeholder species.json entries', () => {
    expect(
      isUsableSpecies({
        id: 'american-lobster',
        name: 'American lobster',
        thresholdC: null,
        source: '',
        verified: false,
      }),
    ).toBe(false);
  });
});

// Generators over the full raw-row input space: in-box and out-of-box coords,
// in-range and out-of-range temps, valid and invalid timestamps, sentinels.
const latInBox = fc.double({ min: MA_BOX.latMin, max: MA_BOX.latMax, noNaN: true });
const lonInBox = fc.double({ min: MA_BOX.lonMin, max: MA_BOX.lonMax, noNaN: true });
const tempInRange = fc.double({ min: TEMP_MIN_C, max: TEMP_MAX_C, noNaN: true });
const validTime = fc.constantFrom(
  '2024-08-01T00:00:00Z',
  '2024-08-04T12:30:00Z',
  '2024-08-07T23:59:59Z',
);

const inBoundsRow: fc.Arbitrary<RawOceanRow> = fc.record({
  time: validTime,
  lat: latInBox,
  lon: lonInBox,
  tempC: tempInRange,
  depthM: fc.option(fc.double({ min: 0, max: 300, noNaN: true }), { nil: 'MM' }),
  nObs: fc.option(fc.integer({ min: 1, max: 50 }), { nil: '' }),
});

// Any raw row, including structurally weird but object-shaped values.
const anyRow: fc.Arbitrary<RawOceanRow> = fc.record({
  time: fc.oneof(validTime, fc.constantFrom('', 'not-a-date', 'MM'), fc.integer()),
  lat: fc.oneof(latInBox, fc.double({ min: -90, max: 90, noNaN: true }), fc.constant('MM')),
  lon: fc.oneof(lonInBox, fc.double({ min: -180, max: 180, noNaN: true }), fc.constant('')),
  tempC: fc.oneof(tempInRange, fc.double({ min: -100, max: 100, noNaN: true }), fc.constant('MM')),
  depthM: fc.option(fc.double({ noNaN: true }), { nil: 'MM' }),
  nObs: fc.option(fc.integer(), { nil: '' }),
});

describe('ocean row validators (P17)', () => {
  // P17: kept + dropped partition is complete and disjoint; counts reconcile.
  // **Validates: Requirements 2.2, 10.2**
  it('partitions every input into kept and dropped with reconciled counts', () => {
    fc.assert(
      fc.property(fc.array(anyRow), (rows) => {
        const { snapshot, dropped } = validateOceanRows(rows, META);
        expect(snapshot.meta.rowCount).toBe(snapshot.rows.length);
        expect(snapshot.meta.droppedCount).toBe(dropped.length);
        expect(snapshot.meta.rowCount + snapshot.meta.droppedCount).toBe(rows.length);
      }),
    );
  });

  // Every kept row is genuinely inside all bounds (R2.2).
  it('only keeps rows inside temperature, coordinate, and timestamp bounds', () => {
    fc.assert(
      fc.property(fc.array(anyRow), (rows) => {
        const { snapshot } = validateOceanRows(rows, META);
        for (const row of snapshot.rows) {
          expect(row.tempC).toBeGreaterThanOrEqual(TEMP_MIN_C);
          expect(row.tempC).toBeLessThanOrEqual(TEMP_MAX_C);
          expect(inMaBox(row.lat, row.lon)).toBe(true);
          expect(Number.isNaN(new Date(row.time).getTime())).toBe(false);
        }
      }),
    );
  });

  // In-bounds rows are always kept (R2.2).
  it('always keeps fully in-bounds rows', () => {
    fc.assert(
      fc.property(fc.array(inBoundsRow, { minLength: 1 }), (rows) => {
        const { snapshot, dropped } = validateOceanRows(rows, META);
        expect(dropped.length).toBe(0);
        expect(snapshot.rows.length).toBe(rows.length);
      }),
    );
  });

  // Out-of-range temperatures are always dropped with the matching reason.
  it('drops rows whose temperature is out of range', () => {
    const outOfRangeTemp = fc.oneof(
      fc.double({ min: -100, max: TEMP_MIN_C - 0.01, noNaN: true }),
      fc.double({ min: TEMP_MAX_C + 0.01, max: 100, noNaN: true }),
    );
    fc.assert(
      fc.property(latInBox, lonInBox, validTime, outOfRangeTemp, (lat, lon, time, tempC) => {
        const { snapshot, dropped } = validateOceanRows([{ time, lat, lon, tempC }], META);
        expect(snapshot.rows.length).toBe(0);
        expect(dropped[0].reason).toBe('temp-out-of-range');
      }),
    );
  });

  // Out-of-box coordinates are always dropped.
  it('drops rows whose coordinates fall outside the MA box', () => {
    const outOfBoxLat = fc.oneof(
      fc.double({ min: -90, max: MA_BOX.latMin - 0.01, noNaN: true }),
      fc.double({ min: MA_BOX.latMax + 0.01, max: 90, noNaN: true }),
    );
    fc.assert(
      fc.property(outOfBoxLat, lonInBox, validTime, tempInRange, (lat, lon, time, tempC) => {
        const { snapshot, dropped } = validateOceanRows([{ time, lat, lon, tempC }], META);
        expect(snapshot.rows.length).toBe(0);
        expect(dropped[0].reason).toBe('coords-out-of-box');
      }),
    );
  });

  // Bad timestamps are always dropped.
  it('drops rows with unparseable timestamps', () => {
    fc.assert(
      fc.property(
        latInBox,
        lonInBox,
        tempInRange,
        fc.constantFrom('', 'not-a-date', 'MM', '2024-13-99'),
        (lat, lon, tempC, time) => {
          const { snapshot, dropped } = validateOceanRows([{ time, lat, lon, tempC }], META);
          expect(snapshot.rows.length).toBe(0);
          expect(dropped[0].reason).toBe('bad-timestamp');
        },
      ),
    );
  });

  // R2.3: "MM"/missing map to null, never 0.
  it('maps MM and missing values to null, never 0', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('MM', '', 'NaN', 'N/A', 'null', null, undefined),
        (sentinel) => {
          expect(toNumberOrNull(sentinel)).toBeNull();
        },
      ),
    );

    const { snapshot } = validateOceanRows(
      [{ time: '2024-08-01T00:00:00Z', lat: 42, lon: -70.5, tempC: 12, depthM: 'MM', nObs: '' }],
      META,
    );
    expect(snapshot.rows[0].depthM).toBeNull();
    expect(snapshot.rows[0].nObs).toBeNull();
    expect(snapshot.rows[0].depthM).not.toBe(0);
  });

  // A real temperature of 0 °C must survive (it is in range, not "missing").
  it('keeps a genuine 0 °C reading rather than treating it as missing', () => {
    const { snapshot, dropped } = validateOceanRows(
      [{ time: '2024-08-01T00:00:00Z', lat: 42, lon: -70.5, tempC: 0 }],
      META,
    );
    expect(dropped.length).toBe(0);
    expect(snapshot.rows[0].tempC).toBe(0);
  });

  it('throws on structurally malformed input', () => {
    // @ts-expect-error intentional bad input
    expect(() => validateOceanRows(null, META)).toThrow(TypeError);
    // @ts-expect-error intentional bad input
    expect(() => validateOceanRows([42], META)).toThrow(TypeError);
  });
});
