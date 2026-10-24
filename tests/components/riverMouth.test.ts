// tests/components/riverMouth.test.ts — Task 9.2 (stretch, requirement R9).
//
// Pure-helper tests for src/components/riverMouth.ts stationsWithinReach. Node
// env, no DOM: we build minimal SiteResult fixtures with a controlled
// thermal.reachM and check the in-reach / out-of-reach / boundary / empty
// cases against the model's own haversineM so distance stays one source of
// truth.

import { describe, it, expect } from 'vitest';

import { stationsWithinReach } from '../../src/components/riverMouth';
import { haversineM } from '../../src/model/grid';
import type { SiteResult, ThermalResult } from '../../src/model/types';
import type { Station } from '../../src/data/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Outfall used by every fixture (Massachusetts Bay, water). */
const OUTFALL = { lat: 42.3, lon: -70.5 };

/** A ThermalResult carrying only the reachM the helper reads. */
function thermalWithReach(reachM: number): ThermalResult {
  return {
    heatW: 0,
    flowM3s: 0,
    flowMGD: 0,
    totalFlowM3s: 0,
    deltaTEffC: 0,
    decayLengthM: 0,
    reachM,
  };
}

/** A minimal SiteResult at OUTFALL with a given negligible-excess reach. */
function makeSite(reachM: number): SiteResult {
  return {
    inputs: {
      lat: OUTFALL.lat,
      lon: OUTFALL.lon,
      facilityMW: 100,
      deltaTC: 4,
      mixRatio: 0,
      heatFraction: 0.88,
    },
    thermal: thermalWithReach(reachM),
    points: [],
    plumeAreaKm2: 0,
    coverage: 1,
    risks: [],
  };
}

function station(id: string, lat: number, lon: number): Station {
  return { id, name: id, lat, lon };
}

// A station exactly at the outfall (distance 0).
const AT_OUTFALL = station('at-outfall', OUTFALL.lat, OUTFALL.lon);

// A station ~0.0135° north of the outfall ≈ 1.5 km away (pure north so
// longitude scaling does not enter). Confirmed below via haversineM.
const NEAR = station('near', OUTFALL.lat + 0.0135, OUTFALL.lon);

// A station far away (> any realistic reach): ~55 km north.
const FAR = station('far', OUTFALL.lat + 0.5, OUTFALL.lon);

const NEAR_DIST_M = haversineM(OUTFALL.lat, OUTFALL.lon, NEAR.lat, NEAR.lon);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('stationsWithinReach (R9)', () => {
  it('flags a station at the outfall (distance 0 ≤ any positive reach)', () => {
    const site = makeSite(2000);
    const result = stationsWithinReach(site, [AT_OUTFALL]);
    expect(result).toEqual([AT_OUTFALL]);
  });

  it('includes a station inside the reach and excludes one outside it', () => {
    // reach sits between NEAR (~1.5 km) and FAR (~55 km).
    const site = makeSite(NEAR_DIST_M + 500);
    const result = stationsWithinReach(site, [NEAR, FAR]);
    expect(result).toEqual([NEAR]);
  });

  it('excludes a station just beyond the reach', () => {
    // reach a hair under NEAR's distance → NEAR is out.
    const site = makeSite(NEAR_DIST_M - 1);
    expect(stationsWithinReach(site, [NEAR])).toEqual([]);
  });

  it('treats the reach boundary as inclusive (distance === reachM)', () => {
    // Set reach to exactly NEAR's distance; the station on the edge is flagged.
    const site = makeSite(NEAR_DIST_M);
    expect(stationsWithinReach(site, [NEAR])).toEqual([NEAR]);
  });

  it('returns an empty array for an empty station list', () => {
    const site = makeSite(5000);
    expect(stationsWithinReach(site, [])).toEqual([]);
  });

  it('returns nothing when reach is zero and no station is exactly at the outfall', () => {
    const site = makeSite(0);
    expect(stationsWithinReach(site, [NEAR, FAR])).toEqual([]);
  });

  it('still flags a coincident station when reach is zero (0 ≤ 0)', () => {
    const site = makeSite(0);
    expect(stationsWithinReach(site, [AT_OUTFALL])).toEqual([AT_OUTFALL]);
  });

  it('preserves input order and does not mutate the input array', () => {
    const site = makeSite(1_000_000); // large reach: all in
    const input = [FAR, AT_OUTFALL, NEAR];
    const result = stationsWithinReach(site, input);
    expect(result).toEqual([FAR, AT_OUTFALL, NEAR]);
    expect(input).toEqual([FAR, AT_OUTFALL, NEAR]); // unchanged
  });
});
