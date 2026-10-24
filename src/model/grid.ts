// src/model/grid.ts — Task 3.1 (design.md, .kiro/steering/thermal-model.md v2.1).
// Pure, deterministic, no I/O. SI units internally; numeric names carry unit suffixes.
//
// Satisfies:
//   R4.1 — build the 250 m fine sampling grid within R_REF_M of the outfall,
//          discard land points, and attach each retained point's containing
//          baseline cell temperature and depth.

import type {
  Feature,
  FeatureCollection,
  Geometry,
  MultiPolygon,
  Polygon,
  Position,
} from 'geojson';

import { R_REF_M, SAMPLE_SPACING_M } from './constants';
import type { BaselineCell, SamplePoint } from './types';

/** Mean Earth radius (m), for the haversine great-circle approximation. */
const EARTH_RADIUS_M = 6_371_000;

/** Meters per degree of latitude (great-circle, roughly constant). */
const M_PER_DEG_LAT = (Math.PI / 180) * EARTH_RADIUS_M;

/** A geographic position used throughout the grid math. */
export interface LatLon {
  lat: number;
  lon: number;
}

/**
 * Great-circle distance between two lat/lon points, in meters, using the
 * haversine formula. Deterministic and symmetric.
 *
 * @param lat1 Latitude of the first point (degrees).
 * @param lon1 Longitude of the first point (degrees).
 * @param lat2 Latitude of the second point (degrees).
 * @param lon2 Longitude of the second point (degrees).
 * @returns Distance in meters (≥ 0).
 */
export function haversineM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLambda = ((lon2 - lon1) * Math.PI) / 180;

  const sinDPhi = Math.sin(dPhi / 2);
  const sinDLambda = Math.sin(dLambda / 2);
  const a =
    sinDPhi * sinDPhi +
    Math.cos(phi1) * Math.cos(phi2) * sinDLambda * sinDLambda;
  // Clamp to [0, 1] to guard against tiny floating-point overshoot before sqrt.
  const clamped = a < 0 ? 0 : a > 1 ? 1 : a;
  const c = 2 * Math.atan2(Math.sqrt(clamped), Math.sqrt(1 - clamped));
  return EARTH_RADIUS_M * c;
}

/** Axis-aligned bounding box in lon/lat degrees. */
interface BBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

/** A polygon ring list (outer ring first, then holes) paired with its bbox. */
interface PreparedPolygon {
  rings: Position[][];
  bbox: BBox;
}

/** Compute the bounding box of one or more rings of [lon, lat] positions. */
function ringsBBox(rings: Position[][]): BBox {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const ring of rings) {
    for (const pos of ring) {
      const lon = pos[0];
      const lat = pos[1];
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return { minLon, minLat, maxLon, maxLat };
}

/**
 * Flatten a land FeatureCollection into a list of prepared polygons, each with
 * a precomputed bounding box. Handles Polygon and MultiPolygon geometries and
 * ignores any other geometry type. An empty collection yields an empty list.
 */
function preparePolygons(
  land: FeatureCollection | null | undefined,
): PreparedPolygon[] {
  const prepared: PreparedPolygon[] = [];
  if (!land || !Array.isArray(land.features)) return prepared;

  const addPolygon = (rings: Position[][]): void => {
    if (rings.length === 0) return;
    prepared.push({ rings, bbox: ringsBBox(rings) });
  };

  for (const feature of land.features as Feature<Geometry>[]) {
    const geom = feature?.geometry;
    if (!geom) continue;
    if (geom.type === 'Polygon') {
      addPolygon((geom as Polygon).coordinates);
    } else if (geom.type === 'MultiPolygon') {
      for (const polyRings of (geom as MultiPolygon).coordinates) {
        addPolygon(polyRings);
      }
    }
  }
  return prepared;
}

/**
 * Ray-casting point-in-ring test. Returns true when (lon, lat) lies inside the
 * ring. Deterministic; boundary handling is consistent across calls.
 */
function pointInRing(lon: number, lat: number, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Point-in-polygon with holes: inside the outer ring and outside every hole.
 */
function pointInPolygon(lon: number, lat: number, rings: Position[][]): boolean {
  if (rings.length === 0) return false;
  if (!pointInRing(lon, lat, rings[0])) return false;
  for (let h = 1; h < rings.length; h++) {
    if (pointInRing(lon, lat, rings[h])) return false; // inside a hole → not land
  }
  return true;
}

/** True when (lon, lat) falls inside any prepared land polygon. */
function isOnLand(lon: number, lat: number, polygons: PreparedPolygon[]): boolean {
  for (const poly of polygons) {
    const { bbox } = poly;
    // Bounding-box precheck: cheap reject before the full ray cast.
    if (
      lon < bbox.minLon ||
      lon > bbox.maxLon ||
      lat < bbox.minLat ||
      lat > bbox.maxLat
    ) {
      continue;
    }
    if (pointInPolygon(lon, lat, poly.rings)) return true;
  }
  return false;
}

/**
 * Find the baseline cell that contains a point, defined deterministically as
 * the cell whose center is nearest to the point and within half a cell spacing
 * on both axes (a ~7 km FIShBOT grid). Returns null when no cell qualifies.
 *
 * Containment uses a planar approximation local to the point, which is accurate
 * at these cell sizes and keeps the test deterministic and order-independent
 * (ties broken by the smaller squared distance, then by cell id).
 */
function containingCell(
  lat: number,
  lon: number,
  cells: BaselineCell[],
  halfCellM: number,
): BaselineCell | null {
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const mPerDegLon = M_PER_DEG_LAT * cosLat;

  let best: BaselineCell | null = null;
  let bestDist2 = Infinity;
  for (const cell of cells) {
    const dNorthM = (cell.lat - lat) * M_PER_DEG_LAT;
    const dEastM = (cell.lon - lon) * mPerDegLon;
    // Must fall within the cell's half-extent on both axes to be "contained".
    if (Math.abs(dNorthM) > halfCellM || Math.abs(dEastM) > halfCellM) continue;
    const dist2 = dNorthM * dNorthM + dEastM * dEastM;
    if (dist2 < bestDist2 || (dist2 === bestDist2 && best !== null && cell.id < best.id)) {
      bestDist2 = dist2;
      best = cell;
    }
  }
  return best;
}

/**
 * FIShBOT gridded cell size (m). The baseline cells are ~7 km on a side;
 * "containing cell" means within half that extent of a cell center.
 */
const BASELINE_CELL_M = 7000;

/**
 * True when an outfall location falls inside the land mask.
 *
 * Exposes the same ray-casting + bounding-box point-in-polygon logic that
 * `samplePoints` uses to discard land points, so `runSite` can reject an
 * on-land outfall without duplicating the geometry code. An empty or missing
 * land collection yields false (nothing is land).
 *
 * @param outfall Discharge location.
 * @param land Land-mask polygons as a GeoJSON FeatureCollection (may be empty).
 * @returns true when the outfall is inside any land polygon.
 */
export function isOutfallOnLand(
  outfall: LatLon,
  land: FeatureCollection | null | undefined,
): boolean {
  const polygons = preparePolygons(land);
  return isOnLand(outfall.lon, outfall.lat, polygons);
}

/**
 * Build the fine sampling grid for an outfall and attach baseline data.
 *
 * Generates a square lattice at {@link SAMPLE_SPACING_M} spacing centered on the
 * outfall, keeps points within {@link R_REF_M} (haversine), discards points
 * inside the land mask, and attaches each retained point's containing baseline
 * cell temperature (`baselineC`) and depth (`depthM`), or null when no cell
 * contains the point.
 *
 * Pure and deterministic: points are emitted in a fixed row-major order and the
 * land/cell lookups depend only on the inputs.
 *
 * @param outfall Discharge location (water point; the caller rejects land).
 * @param cells Baseline FIShBOT cells (may be empty).
 * @param land Land-mask polygons as a GeoJSON FeatureCollection (may be empty).
 * @returns Retained water {@link SamplePoint}s within the sampling disc.
 */
export function samplePoints(
  outfall: LatLon,
  cells: BaselineCell[],
  land: FeatureCollection | null | undefined,
): SamplePoint[] {
  const polygons = preparePolygons(land);
  const halfCellM = BASELINE_CELL_M / 2;

  // Local degrees-per-meter conversions centered on the outfall. Using the
  // outfall latitude keeps the lattice square in meters to good approximation
  // across the ≤ 20 km disc.
  const cosLat = Math.cos((outfall.lat * Math.PI) / 180);
  const mPerDegLon = M_PER_DEG_LAT * cosLat;
  const degPerMLat = 1 / M_PER_DEG_LAT;
  // Guard against the degenerate pole case (cosLat → 0); MA coast is far away.
  const degPerMLon = mPerDegLon > 0 ? 1 / mPerDegLon : 0;

  // Number of lattice steps from center to the disc edge on each axis.
  const steps = Math.floor(R_REF_M / SAMPLE_SPACING_M);

  const points: SamplePoint[] = [];
  for (let i = -steps; i <= steps; i++) {
    const offsetNorthM = i * SAMPLE_SPACING_M;
    const lat = outfall.lat + offsetNorthM * degPerMLat;
    for (let j = -steps; j <= steps; j++) {
      const offsetEastM = j * SAMPLE_SPACING_M;
      const lon = outfall.lon + offsetEastM * degPerMLon;

      const distanceM = haversineM(outfall.lat, outfall.lon, lat, lon);
      if (distanceM > R_REF_M) continue;
      if (isOnLand(lon, lat, polygons)) continue;

      const cell = containingCell(lat, lon, cells, halfCellM);
      points.push({
        lat,
        lon,
        distanceM,
        baselineC: cell ? cell.tempC : null,
        depthM: cell ? cell.depthM : null,
      });
    }
  }
  return points;
}
