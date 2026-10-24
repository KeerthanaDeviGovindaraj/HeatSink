/**
 * Fine sampling grid generation and baseline/depth assignment. Pure, no I/O.
 * Implemented in a later task (see thermal-model.md "Fine sampling grid").
 */
import type { BaselineCell, LatLng, SamplePoint } from './types';

/** Haversine distance in metres between two points. */
export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latDeg - a.latDeg);
  const dLon = toRad(b.lonDeg - a.lonDeg);
  const lat1 = toRad(a.latDeg);
  const lat2 = toRad(b.latDeg);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Build water-only sample points around the outfall. Discards land points and
 * assigns baseline/depth from the containing cell. Implemented in a later task.
 */
export function buildSampleGrid(
  _outfall: LatLng,
  _cells: BaselineCell[],
  _landMask: GeoJSON.FeatureCollection,
): SamplePoint[] {
  throw new Error('buildSampleGrid not implemented yet');
}
