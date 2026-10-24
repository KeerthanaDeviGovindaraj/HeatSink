import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  NO_DATA_COLOR,
  colorForTemp,
  formatOptional,
  formatTemp,
  isNoData,
  legendStops,
  round1,
} from '../../src/components/colorScale';
import { cToF } from '../../src/model/units';

describe('colorScale', () => {
  // R1.4 — null/NaN temperatures use the distinct no-data sentinel, never a fill color.
  it('maps null/undefined/NaN to the no-data color (R1.4)', () => {
    expect(colorForTemp(null)).toBe(NO_DATA_COLOR);
    expect(colorForTemp(undefined)).toBe(NO_DATA_COLOR);
    expect(colorForTemp(NaN)).toBe(NO_DATA_COLOR);
    expect(isNoData(null)).toBe(true);
    expect(isNoData(NaN)).toBe(true);
    expect(isNoData(0)).toBe(false);
  });

  it('never returns the no-data color for a real temperature (R1.4)', () => {
    for (const t of [-5, 0, 4, 7, 10, 13, 16, 19, 22, 35]) {
      expect(colorForTemp(t)).not.toBe(NO_DATA_COLOR);
    }
  });

  // R1.2 — the ramp is perceptually ordered: a colder reading never maps "past"
  // a warmer one. We encode that by checking the band index is non-decreasing in °C.
  it('is monotonic cold→warm across the domain (R1.2)', () => {
    const stops = legendStops();
    // Map a temperature to the index of the band it falls in.
    const bandIndex = (t: number) =>
      stops.findIndex((s) => (s.toC == null || t <= s.toC) && (!Number.isFinite(s.fromC) || t > s.fromC));

    fc.assert(
      fc.property(
        fc.double({ min: -2, max: 35, noNaN: true }),
        fc.double({ min: -2, max: 35, noNaN: true }),
        (a, b) => {
          const lo = Math.min(a, b);
          const hi = Math.max(a, b);
          expect(bandIndex(lo)).toBeLessThanOrEqual(bandIndex(hi));
        },
      ),
    );
  });

  it('each color maps to exactly one contiguous legend band', () => {
    const stops = legendStops();
    const colors = stops.map((s) => s.color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  // R1.2 — legend carries both °C and °F, and °F is derived from °C via cToF.
  it('legend °F bounds agree with cToF of the °C bounds (R1.2)', () => {
    for (const s of legendStops()) {
      if (Number.isFinite(s.fromC)) {
        expect(s.fromF).toBeCloseTo(round1(cToF(s.fromC)), 6);
      }
      if (s.toC != null) {
        expect(s.toF).toBeCloseTo(round1(cToF(s.toC!)), 6);
      }
    }
  });

  it('legend bands are contiguous and cover the domain open-ended at both ends', () => {
    const stops = legendStops();
    expect(stops[0].fromC).toBe(-Infinity);
    expect(stops[stops.length - 1].toC).toBeNull();
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i].fromC).toBe(stops[i - 1].toC);
    }
  });

  // R1.5 — tooltip formatting shows °C and °F, and null fields as "—", never 0.
  it('formatTemp shows °C and °F, null as em dash (R1.5)', () => {
    expect(formatTemp(10)).toBe('10 °C (50 °F)');
    expect(formatTemp(null)).toBe('—');
    expect(formatTemp(NaN)).toBe('—');
  });

  it('formatOptional shows value with suffix, null/NaN as em dash, 0 as 0 (R1.5)', () => {
    expect(formatOptional(192)).toBe('192');
    expect(formatOptional(26, ' m')).toBe('26 m');
    expect(formatOptional(null)).toBe('—');
    expect(formatOptional(undefined)).toBe('—');
    expect(formatOptional(NaN)).toBe('—');
    expect(formatOptional(0)).toBe('0');
  });
});
