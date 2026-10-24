/**
 * CompareTable — ranked comparison of up to 4 saved sites (task 7.2, R6.2–R6.5).
 *
 * Presentational. App owns the saved-sites state and passes them in; this
 * component only ranks and renders. All ranking/label logic lives in the pure
 * `compare.ts` helpers (unit/property-tested in tests/components/compare.test.ts);
 * the DOM here just formats what they return.
 *
 * Columns (R6.4): site label + lat/lon, key inputs (facilityMW, deltaTC,
 * mixRatio, heatFraction), flow (MGD + m³/s), plume area (km²), coverage (%),
 * and one score/level cell PER species. Sites are sorted LOWEST RISK FIRST
 * (rankSites). Per-species cells apply R6.2 (grey "Insufficient data" below
 * MIN_COVERAGE) and R6.5 ("Low impact at screening level" when no newly
 * exceeded area with sufficient coverage).
 *
 * Every figure here is MODELED. An assumptions footnote lists the key
 * placeholder calibration constants (R6.3), read from constants.ts so no number
 * is hard-coded.
 */
import type { CSSProperties } from 'react';
import type { SpeciesEntry, Station } from '../data/types';
import { stationsWithinReach } from './riverMouth';
import {
  AREA_SCALE_KM2,
  MIN_COVERAGE,
  NEGLIGIBLE_C,
  R_REF_M,
  SHALLOW_DEPTH_M,
} from '../model/constants';
import type { SpeciesRisk } from '../model/types';
import {
  hasSufficientCoverage,
  rankSites,
  speciesCellLabel,
  type SavedSite,
} from './compare';

export interface CompareTableProps {
  /** Saved sites to compare (App caps at 4); rendered lowest-risk-first. */
  sites: SavedSite[];
  /** Displayable species, for the id → name column headers (R6.4). */
  species: SpeciesEntry[];
  /** Remove one saved site by id. */
  onRemove: (id: string) => void;
  /**
   * River-mouth flag (stretch R9). When `showRiverMouthFlag` is true, an extra
   * column flags, per site, how many of these diadromous fish `stations` fall
   * within that site's plume reach. Off by default so existing columns and
   * behavior are unchanged when the feature is disabled.
   */
  stations?: readonly Station[];
  /** Whether to show the river-mouth flag column (R9 "WHEN enabled"). */
  showRiverMouthFlag?: boolean;
}

/** Format a coverage fraction as a whole percent, e.g. 0.82 → "82%". */
function formatCoverage(coverage: number): string {
  return `${Math.round(coverage * 100)}%`;
}

/** Format a lat/lon pair with three decimals. */
function formatLatLon(lat: number, lon: number): string {
  return `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
}

const CELL: CSSProperties = {
  padding: '0.4rem 0.6rem',
  borderBottom: '1px solid #eceff1',
  fontSize: '0.82rem',
  textAlign: 'left',
  verticalAlign: 'top',
  whiteSpace: 'nowrap',
};

const HEAD_CELL: CSSProperties = {
  ...CELL,
  borderBottom: '2px solid #cfd8dc',
  fontWeight: 600,
  color: '#37474f',
};

/** One per-species score cell, styling R6.2 (grey) / R6.5 (low impact). */
function SpeciesCell({
  risk,
  minCoverageMet,
}: {
  risk: SpeciesRisk | undefined;
  minCoverageMet: boolean;
}) {
  // No risk for this species at this site (species not scored) — blank.
  if (!risk) {
    return <td style={{ ...CELL, color: '#b0bec5' }}>—</td>;
  }
  const label = speciesCellLabel(risk, { minCoverageMet });
  const color = label.insufficient
    ? '#b0bec5' // greyed out (R6.2)
    : label.lowImpact
      ? '#2e7d32' // reassuring green (R6.5)
      : '#263238';
  return (
    <td
      style={{
        ...CELL,
        color,
        fontStyle: label.insufficient ? 'italic' : 'normal',
        whiteSpace: 'normal',
      }}
    >
      {label.text}
    </td>
  );
}

/**
 * River-mouth flag cell (stretch R9): how many diadromous fish stations fall
 * within this site's plume reach, listing which ones. Reassuring grey when none
 * are in reach; a warning amber with the river/station names when some are.
 */
function RiverMouthCell({ inReach }: { inReach: Station[] }) {
  if (inReach.length === 0) {
    return (
      <td style={{ ...CELL, color: '#607d8b', whiteSpace: 'normal' }}>
        None in reach
      </td>
    );
  }
  return (
    <td
      style={{
        ...CELL,
        color: '#8d6e00',
        fontWeight: 600,
        whiteSpace: 'normal',
      }}
    >
      {inReach.length} in reach
      <br />
      <span style={{ fontWeight: 400, color: '#78909c', fontSize: '0.72rem' }}>
        {inReach.map((s) => s.river ?? s.name).join(', ')}
      </span>
    </td>
  );
}

export function CompareTable({
  sites,
  species,
  onRemove,
  stations,
  showRiverMouthFlag = false,
}: CompareTableProps) {
  const ranked = rankSites(sites);
  // Only compute reach flags when the feature is enabled and stations exist.
  const riverMouthOn = showRiverMouthFlag && !!stations && stations.length > 0;

  return (
    <section
      data-testid="compare-table"
      aria-label="Site comparison"
      style={{
        border: '1px solid #cfd8dc',
        borderRadius: 8,
        padding: '0.9rem 1rem',
        background: '#fff',
      }}
    >
      <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>
        Compare sites{' '}
        <span
          style={{ fontSize: '0.7rem', color: '#607d8b', letterSpacing: '0.03em' }}
        >
          · MODELED · lowest risk first
        </span>
      </h2>

      {ranked.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#78909c' }}>
          No saved sites yet — save a site to compare.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              borderCollapse: 'collapse',
              width: '100%',
              minWidth: '42rem',
            }}
          >
            <thead>
              <tr>
                <th style={HEAD_CELL}>Site</th>
                <th style={HEAD_CELL}>
                  Inputs
                  <br />
                  <span style={{ fontWeight: 400, color: '#78909c' }}>
                    MW · ΔT · mix · heat
                  </span>
                </th>
                <th style={HEAD_CELL}>
                  Flow
                  <br />
                  <span style={{ fontWeight: 400, color: '#78909c' }}>
                    MGD (m³/s)
                  </span>
                </th>
                <th style={HEAD_CELL}>Plume area</th>
                <th style={HEAD_CELL}>Coverage</th>
                {species.map((s) => (
                  <th key={s.id} style={HEAD_CELL}>
                    {s.name}
                    <br />
                    <span style={{ fontWeight: 400, color: '#78909c' }}>
                      score · level
                    </span>
                  </th>
                ))}
                {riverMouthOn && (
                  <th style={HEAD_CELL}>
                    River-mouth flag
                    <br />
                    <span style={{ fontWeight: 400, color: '#78909c' }}>
                      stations in reach
                    </span>
                  </th>
                )}
                <th style={HEAD_CELL} aria-label="Remove" />
              </tr>
            </thead>
            <tbody>
              {ranked.map((site) => {
                const { result } = site;
                const { inputs, thermal } = result;
                const minCoverageMet = hasSufficientCoverage(result);
                const risksById = new Map(
                  result.risks.map((r) => [r.speciesId, r]),
                );
                return (
                  <tr key={site.id}>
                    <td style={CELL}>
                      <strong>{site.label}</strong>
                      <br />
                      <span style={{ color: '#78909c', fontSize: '0.72rem' }}>
                        {formatLatLon(inputs.lat, inputs.lon)}
                      </span>
                    </td>
                    <td
                      style={{
                        ...CELL,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {inputs.facilityMW} MW · {inputs.deltaTC} °C ·{' '}
                      {inputs.mixRatio}× · {inputs.heatFraction}
                    </td>
                    <td
                      style={{ ...CELL, fontVariantNumeric: 'tabular-nums' }}
                    >
                      {Math.round(thermal.flowMGD)} MGD
                      <br />
                      <span style={{ color: '#78909c', fontSize: '0.72rem' }}>
                        {thermal.flowM3s.toFixed(2)} m³/s
                      </span>
                    </td>
                    <td
                      style={{ ...CELL, fontVariantNumeric: 'tabular-nums' }}
                    >
                      {result.plumeAreaKm2.toFixed(2)} km²
                    </td>
                    <td
                      style={{
                        ...CELL,
                        fontVariantNumeric: 'tabular-nums',
                        color: minCoverageMet ? '#263238' : '#c62828',
                      }}
                    >
                      {formatCoverage(result.coverage)}
                    </td>
                    {species.map((s) => (
                      <SpeciesCell
                        key={s.id}
                        risk={risksById.get(s.id)}
                        minCoverageMet={minCoverageMet}
                      />
                    ))}
                    {riverMouthOn && (
                      <RiverMouthCell inReach={stationsWithinReach(result, stations as Station[])} />
                    )}
                    <td style={CELL}>
                      <button
                        type="button"
                        onClick={() => onRemove(site.id)}
                        aria-label={`Remove ${site.label}`}
                        style={{
                          border: '1px solid #e0b4b0',
                          background: '#fdecea',
                          color: '#611a15',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          padding: '0.2rem 0.5rem',
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Assumptions footnote (R6.3): the key MODELED placeholder constants. */}
      <p
        style={{
          margin: '0.7rem 0 0',
          fontSize: '0.72rem',
          color: '#78909c',
          lineHeight: 1.5,
        }}
      >
        <strong>Modeled placeholders (assumptions):</strong> score scale
        AREA_SCALE_KM2 = {AREA_SCALE_KM2} km²; minimum coverage for a score
        MIN_COVERAGE = {Math.round(MIN_COVERAGE * 100)}%; negligible excess
        NEGLIGIBLE_C = {NEGLIGIBLE_C} °C; shallow-water depth SHALLOW_DEPTH_M ={' '}
        {SHALLOW_DEPTH_M} m; sampling radius R_REF_M = {R_REF_M / 1000} km. These
        are screening calibration values, not measured or permit figures.
      </p>
    </section>
  );
}
