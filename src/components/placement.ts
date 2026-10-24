/**
 * Pure decision logic for click-to-place (R3.2).
 *
 * The map hands a clicked lat/lon to {@link evaluateOutfallPlacement}, which is
 * the single source of truth for whether a click places the outfall or is
 * rejected for being on land. Keeping it pure (no React, no Leaflet) lets the
 * node-env vitest suite exercise the real decision against the committed land
 * mask without a DOM.
 *
 * Rule (R3.2): IF the click is inside LAND_MASK THEN the outfall is NOT placed
 * and a friendly "must be in water" message is returned; otherwise the outfall
 * is placed and there is no message.
 *
 * Reuses `isOutfallOnLand` from the model so the UI and `runSite` agree on what
 * counts as land — the UI never reimplements point-in-polygon.
 */
import type { FeatureCollection } from 'geojson';
import { isOutfallOnLand, type LatLon } from '../model/grid';

/** Message shown when a user clicks on land (R3.2). */
export const LAND_MESSAGE =
  'The outfall must be in the water. Pick a spot offshore.';

/** Outcome of evaluating a map click for outfall placement. */
export interface PlacementResult {
  /** True when the click is in water and the outfall should be placed. */
  placed: boolean;
  /** The location to place the outfall at, or null when rejected (on land). */
  outfall: LatLon | null;
  /** A friendly rejection message when on land, else null. */
  message: string | null;
}

/**
 * Decide whether a clicked location places the outfall.
 *
 * @param latlng The clicked location.
 * @param land The land-mask polygons (may be null when the mask failed to
 *   load; with no mask nothing is land, so the click is placed).
 * @returns A {@link PlacementResult}: placed in water (no message), or rejected
 *   on land (not placed, with {@link LAND_MESSAGE}).
 */
export function evaluateOutfallPlacement(
  latlng: LatLon,
  land: FeatureCollection | null | undefined,
): PlacementResult {
  if (isOutfallOnLand(latlng, land)) {
    return { placed: false, outfall: null, message: LAND_MESSAGE };
  }
  return { placed: true, outfall: latlng, message: null };
}
