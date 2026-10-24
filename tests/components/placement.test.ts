import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import fc from 'fast-check';
import type { FeatureCollection } from 'geojson';
import {
  LAND_MESSAGE,
  evaluateOutfallPlacement,
} from '../../src/components/placement';
import { isOutfallOnLand } from '../../src/model/grid';

/**
 * Tests for the pure click-to-place decision (R3.2). The vitest env is `node`
 * and @testing-library/react is not installed, so we test the decision logic
 * directly against the committed land mask read from disk — no DOM, no Leaflet.
 */

// Load the real committed MA land mask the browser would fetch at runtime.
const land = JSON.parse(
  readFileSync(
    resolve(__dirname, '../../public/data/ma-land.geojson'),
    'utf8',
  ),
) as FeatureCollection;

// Known points: Boston is on land; a spot ~offshore east of Cape Cod Bay is water.
const BOSTON = { lat: 42.3601, lon: -71.0589 };
const OFFSHORE_WATER = { lat: 42.3, lon: -70.5 };

describe('evaluateOutfallPlacement (R3.2)', () => {
  it('rejects a known land point with a message and does not place it', () => {
    // Sanity: the fixture really marks Boston as land.
    expect(isOutfallOnLand(BOSTON, land)).toBe(true);

    const result = evaluateOutfallPlacement(BOSTON, land);
    expect(result.placed).toBe(false);
    expect(result.outfall).toBeNull();
    expect(result.message).toBe(LAND_MESSAGE);
  });

  it('places a known water point with no message', () => {
    // Sanity: the fixture really marks the offshore point as water.
    expect(isOutfallOnLand(OFFSHORE_WATER, land)).toBe(false);

    const result = evaluateOutfallPlacement(OFFSHORE_WATER, land);
    expect(result.placed).toBe(true);
    expect(result.outfall).toEqual(OFFSHORE_WATER);
    expect(result.message).toBeNull();
  });

  it('treats a null land mask as all-water (places with no message)', () => {
    const result = evaluateOutfallPlacement(BOSTON, null);
    expect(result.placed).toBe(true);
    expect(result.outfall).toEqual(BOSTON);
    expect(result.message).toBeNull();
  });

  it('agrees with isOutfallOnLand for any clicked point (decision is a function of the land test)', () => {
    // Property: the helper places exactly the points the model says are water,
    // and rejects exactly those it says are land — never both, never neither.
    const latlngArb = fc.record({
      lat: fc.double({ min: 41.0, max: 43.0, noNaN: true, noDefaultInfinity: true }),
      lon: fc.double({ min: -73.6, max: -69.8, noNaN: true, noDefaultInfinity: true }),
    });

    fc.assert(
      fc.property(latlngArb, (latlng) => {
        const onLand = isOutfallOnLand(latlng, land);
        const result = evaluateOutfallPlacement(latlng, land);

        if (onLand) {
          expect(result.placed).toBe(false);
          expect(result.outfall).toBeNull();
          expect(result.message).toBe(LAND_MESSAGE);
        } else {
          expect(result.placed).toBe(true);
          expect(result.outfall).toEqual(latlng);
          expect(result.message).toBeNull();
        }
      }),
    );
  });
});
