/**
 * PlumePanel — screening-plume results (task 6.3, R4.3, R4.4).
 *
 * Presentational. Given a {@link SiteResult} it shows:
 *   - plume area in km² (result.plumeAreaKm2) and reach in km
 *     (result.thermal.reachM / 1000) — R4.4;
 *   - the shallow-water outcome from the model: how many plume points the
 *     discharge reaches at the bottom only ("surface only", deepSurfaceOnly)
 *     and how many sit over water of unknown depth ("depth unknown",
 *     depthM === null), with the shallow-water caveat note — R4.3.
 *
 * All figures are MODELED (labeled as such). The panel renders only when a
 * result is present; App keeps the AssumptionsBanner visible above it (R4.6).
 */
import { summarizePoints } from '../model/plume';
import type { SiteResult } from '../model/types';
import { SHALLOW_DEPTH_M } from '../model/constants';

export interface PlumePanelProps {
  /** The screening result for the placed outfall. */
  result: SiteResult;
}

/** Format meters as kilometers with one decimal (e.g. 3521 m → "3.5 km"). */
function formatKm(meters: number): string {
  return `${(meters / 1000).toFixed(1)} km`;
}

/** Format a km² figure with two decimals. */
function formatKm2(km2: number): string {
  return `${km2.toFixed(2)} km²`;
}

export function PlumePanel({ result }: PlumePanelProps) {
  const { plumeAreaKm2, thermal, points } = result;
  const { plumePointCount, deepSurfaceOnlyCount, unknownDepthCount } =
    summarizePoints(points);

  return (
    <section
      data-testid="plume-panel"
      aria-label="Plume results"
      style={{
        border: '1px solid #cfd8dc',
        borderRadius: 8,
        padding: '0.9rem 1rem',
        background: '#fff',
      }}
    >
      <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>
        Screening plume{' '}
        <span style={{ fontSize: '0.7rem', color: '#607d8b', letterSpacing: '0.03em' }}>
          · MODELED
        </span>
      </h2>

      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          rowGap: '0.25rem',
          columnGap: '0.6rem',
          margin: '0 0 0.6rem',
          fontSize: '0.9rem',
        }}
      >
        <dt>Plume area</dt>
        <dd style={{ margin: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {formatKm2(plumeAreaKm2)}
        </dd>
        <dt>Reach (to negligible)</dt>
        <dd style={{ margin: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {formatKm(thermal.reachM)}
        </dd>
        <dt>Plume sample points</dt>
        <dd style={{ margin: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {plumePointCount}
        </dd>
      </dl>

      {/* Shallow-water outcome (R4.3). */}
      <div
        style={{
          padding: '0.6rem 0.7rem',
          background: '#f5f7f8',
          borderRadius: 6,
          fontSize: '0.82rem',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>Bottom reach</div>
        <ul style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.5 }}>
          <li>
            <strong>{deepSurfaceOnlyCount}</strong> plume point
            {deepSurfaceOnlyCount === 1 ? '' : 's'} in deep water (&gt; {SHALLOW_DEPTH_M} m):
            warm water assumed to stay at the surface only.
          </li>
          <li>
            <strong>{unknownDepthCount}</strong> plume point
            {unknownDepthCount === 1 ? '' : 's'} over water of unknown depth: treated
            conservatively as reaching the bottom.
          </li>
        </ul>
        <p style={{ margin: '0.4rem 0 0', color: '#78909c' }}>
          Shallow-water rule: the discharge is assumed to reach the bottom only in water
          ≤ {SHALLOW_DEPTH_M} m deep.
        </p>
      </div>
    </section>
  );
}
