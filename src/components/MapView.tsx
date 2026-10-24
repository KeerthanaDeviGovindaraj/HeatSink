/**
 * Leaflet map of coastal Massachusetts bottom temperatures (FIShBOT baseline).
 *
 * Renders the committed snapshot's point centroids as CircleMarkers colored by a
 * colorblind-safe ramp, with a °C/°F legend, distinct no-data styling, and a
 * per-cell tooltip (R1.1, R1.2, R1.4, R1.5). The baseline layer is labeled with
 * the shared FIShBOT layer label "MEASURED (gridded daily average)" (R1.3).
 *
 * MapView is now presentational: App (via useSnapshots) owns loading so the
 * baseline and the Footer meta share one fetch, and a load failure renders the
 * shared ErrorCard instead of a blank map (R1.7). Plume overlay and
 * click-to-place arrive in later tasks.
 */
import {
  Circle,
  CircleMarker,
  MapContainer,
  TileLayer,
  Tooltip,
  useMapEvents,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { LatLon } from '../model/grid';
import type { PlumeRing } from '../model/plume';
import type { OceanRow } from '../data/types';
import {
  NO_DATA_COLOR,
  colorForTemp,
  formatOptional,
  formatTemp,
  isNoData,
  legendStops,
} from './colorScale';
import { layerLabel } from './layerLabels';

// MA coast view: data spans lat 41.2–43.0, lon -71.2 to -69.8 (R1.1).
const MAP_CENTER: [number, number] = [42.1, -70.5];
const MAP_ZOOM = 8;
const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{x}/{y}/{z}.png';
const OSM_ATTRIBUTION = '&copy; OpenStreetMap contributors';

const BASELINE_LABEL = layerLabel('fishbot');

/** Outfall marker color (MODELED placement, distinct from baseline cells). */
const OUTFALL_COLOR = '#d81b60';

/**
 * Plume-ring stroke color (translucent orange/red). The same hue is used for
 * every ring; inner (hotter) rings get a higher fill opacity so the concentric
 * bands read as a heat gradient, distinct from the blue→red baseline cells.
 */
const RING_COLOR = '#e65100';

/** Fill opacity for a ring, hotter (inner) rings more opaque. Index 0 = hottest. */
function ringFillOpacity(index: number, total: number): number {
  // 0.28 for the innermost ring down to ~0.06 for the outermost.
  if (total <= 1) return 0.18;
  const t = index / (total - 1);
  return 0.28 - t * 0.22;
}

export interface MapViewProps {
  /** Baseline FIShBOT rows to plot. */
  rows: OceanRow[];
  /** Date window label for the baseline snapshot, shown in each tooltip. */
  window: string;
  /** Currently placed outfall, or null when none is placed yet (R3.2). */
  outfall?: LatLon | null;
  /** Called with the clicked location on every map click (R3.2). */
  onMapClick?: (latlng: LatLon) => void;
  /**
   * Labeled plume rings to draw around the outfall, outer→inner or inner→outer
   * (any order; drawn largest-first so smaller rings sit on top). Empty or
   * omitted draws no rings (R4.4).
   */
  rings?: readonly PlumeRing[];
}

/**
 * Invisible child that forwards Leaflet map clicks to `onClick`. Must live
 * inside <MapContainer> so react-leaflet's `useMapEvents` can bind to the map.
 */
function ClickCapture({ onClick }: { onClick?: ((latlng: LatLon) => void) | undefined }) {
  useMapEvents({
    click(e) {
      onClick?.({ lat: e.latlng.lat, lon: e.latlng.lng });
    },
  });
  return null;
}

export function MapView({ rows, window, outfall, onMapClick, rings }: MapViewProps) {
  // Draw rings largest-first so the hotter, smaller rings render on top. Sort a
  // copy to avoid mutating the caller's array. `order` gives each ring its
  // hot→cold index for fill opacity (0 = hottest/smallest radius).
  const sortedRings = rings ? [...rings].sort((a, b) => b.radiusM - a.radiusM) : [];

  return (
    <div data-testid="map-view" style={{ position: 'relative' }}>
      <MapContainer
        center={MAP_CENTER}
        zoom={MAP_ZOOM}
        style={{ height: 480, width: '100%', borderRadius: 6 }}
        scrollWheelZoom
      >
        <TileLayer url={OSM_TILE_URL} attribution={OSM_ATTRIBUTION} />
        <ClickCapture onClick={onMapClick} />
        {outfall &&
          sortedRings.map((ring, i) => {
            // Opacity index counts from the hottest (smallest) ring, which is
            // last after the largest-first sort.
            const hotIndex = sortedRings.length - 1 - i;
            return (
              <Circle
                key={`ring-${ring.excessC}`}
                center={[outfall.lat, outfall.lon]}
                radius={ring.radiusM}
                pathOptions={{
                  color: RING_COLOR,
                  weight: 1.5,
                  opacity: 0.8,
                  fillColor: RING_COLOR,
                  fillOpacity: ringFillOpacity(hotIndex, sortedRings.length),
                }}
              >
                <Tooltip sticky>
                  <strong>+{ring.excessC} °C (MODELED)</strong>
                  <br />
                  radius ≈ {(ring.radiusM / 1000).toFixed(1)} km
                </Tooltip>
              </Circle>
            );
          })}
        {outfall && (
          <CircleMarker
            center={[outfall.lat, outfall.lon]}
            radius={10}
            pathOptions={{
              color: '#222',
              weight: 2,
              fillColor: OUTFALL_COLOR,
              fillOpacity: 0.9,
            }}
          >
            <Tooltip permanent direction="top" offset={[0, -8]}>
              <strong>Outfall (MODELED)</strong>
              <br />
              {outfall.lat.toFixed(4)}, {outfall.lon.toFixed(4)}
            </Tooltip>
          </CircleMarker>
        )}
        {rows.map((row, i) => {
          const noData = isNoData(row.tempC);
          return (
            <CircleMarker
              key={`${row.lat},${row.lon},${i}`}
              center={[row.lat, row.lon]}
              radius={8}
              pathOptions={
                noData
                  ? { color: NO_DATA_COLOR, weight: 2, fillOpacity: 0, dashArray: '3 3' }
                  : { color: '#222', weight: 1, fillColor: colorForTemp(row.tempC), fillOpacity: 0.85 }
              }
            >
              <Tooltip>
                <div style={{ lineHeight: 1.4 }}>
                  <strong>{BASELINE_LABEL}</strong>
                  <br />
                  Temp: {formatTemp(row.tempC)}
                  <br />
                  Obs count: {formatOptional(row.nObs)}
                  <br />
                  Depth: {formatOptional(row.depthM, ' m')}
                  <br />
                  Window: {window}
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
      <Legend label={BASELINE_LABEL} />
      {outfall && sortedRings.length > 0 && <RingLegend rings={sortedRings} />}
    </div>
  );
}

/**
 * Legend for the plume rings (R4.4): one swatch per labeled excess level with
 * the MODELED tag and the shallow-water caveat. Positioned top-right so it does
 * not overlap the baseline color legend (bottom-right).
 */
function RingLegend({ rings }: { rings: PlumeRing[] }) {
  // Show hottest level first (smallest radius): reverse the largest-first order.
  const ordered = [...rings].sort((a, b) => b.excessC - a.excessC);
  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 1000,
        background: 'rgba(255,255,255,0.95)',
        padding: '0.5rem 0.6rem',
        borderRadius: 6,
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        font: '12px/1.4 system-ui, sans-serif',
        maxWidth: 190,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>
        Plume rings <span style={{ color: '#607d8b', fontWeight: 600 }}>· MODELED</span>
      </div>
      {ordered.map((ring, i) => (
        <div key={ring.excessC} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              display: 'inline-block',
              width: 14,
              height: 14,
              background: RING_COLOR,
              opacity: ringFillOpacity(i, ordered.length) + 0.25,
              border: `1px solid ${RING_COLOR}`,
              flex: '0 0 auto',
            }}
          />
          <span>
            +{ring.excessC} °C ({(ring.radiusM / 1000).toFixed(1)} km)
          </span>
        </div>
      ))}
      <div style={{ marginTop: 4, color: '#78909c' }}>
        Surface excess over ambient. Reaches the bottom only in water ≤ 20 m deep.
      </div>
    </div>
  );
}

/** Color legend showing each band in °C with the °F equivalent (R1.2). */
function Legend({ label }: { label: string }) {
  const stops = legendStops();
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 12,
        right: 12,
        zIndex: 1000,
        background: 'rgba(255,255,255,0.95)',
        padding: '0.5rem 0.6rem',
        borderRadius: 6,
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        font: '12px/1.4 system-ui, sans-serif',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>Bottom temp</div>
      {stops.map((s) => (
        <div key={s.color} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              display: 'inline-block',
              width: 14,
              height: 14,
              background: s.color,
              border: '1px solid #222',
              flex: '0 0 auto',
            }}
          />
          <span>
            {formatRange(s.fromC, s.toC, '°C')} ({formatRange(s.fromF, s.toF, '°F')})
          </span>
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        <span
          style={{
            display: 'inline-block',
            width: 14,
            height: 14,
            border: `2px dashed ${NO_DATA_COLOR}`,
            flex: '0 0 auto',
          }}
        />
        <span>no data</span>
      </div>
    </div>
  );
}

/** Format a legend band's bounds, handling open-ended first/last bands. */
function formatRange(from: number, to: number | null, unit: string): string {
  if (!Number.isFinite(from)) return `< ${to} ${unit}`;
  if (to == null) return `≥ ${from} ${unit}`;
  return `${from}–${to} ${unit}`;
}
