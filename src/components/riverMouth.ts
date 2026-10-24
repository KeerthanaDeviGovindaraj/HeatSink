/**
 * Pure river-mouth sensitivity helper (stretch R9).
 *
 * "Within a plume's reach" means the great-circle distance from a saved site's
 * outfall (`result.inputs.lat/lon`) to a diadromous fish station is within the
 * site's negligible-excess thermal reach (`result.thermal.reachM`, meters).
 * That is the same reach the plume rings and area use, so a flagged station is
 * one the screening plume would touch.
 *
 * DOM-free and side-effect-free so it unit-tests in a node env; distance reuses
 * the model's {@link haversineM} (one source of truth for great-circle math).
 */
import { haversineM } from '../model/grid';
import type { SiteResult } from '../model/types';
import type { Station } from '../data/types';

/**
 * The diadromous fish stations within a saved site's plume reach (R9).
 *
 * A station is in reach when haversineM(outfall, station) ≤ reachM. The
 * boundary is INCLUSIVE: a station exactly at the reach radius counts as in
 * reach (the plume's outermost ring coincides with the reach, so the edge is
 * "touched"). Preserves the input order of `stations`. An empty station list
 * (or a zero-reach site) yields an empty array.
 *
 * Pure: depends only on its inputs and never mutates them.
 *
 * @param site A saved site's screening result (outfall + thermal reach).
 * @param stations Candidate diadromous stations.
 * @returns The subset of `stations` within the site's reach, in input order.
 */
export function stationsWithinReach(
  site: SiteResult,
  stations: Station[],
): Station[] {
  const { lat, lon } = site.inputs;
  const reachM = site.thermal.reachM;
  return stations.filter(
    (s) => haversineM(lat, lon, s.lat, s.lon) <= reachM,
  );
}
