/**
 * CumulativePanel — cumulative-mode results (task 9.1, stretch; R8).
 *
 * Presentational. Given a {@link CumulativeResult} (the SUPERPOSED field over
 * the saved sites) it shows the combined plume area and per-species
 * newly/already-exceeded areas, computed with the same risk functions as a
 * single site so the numbers line up with the rest of the app.
 *
 * Everything here is MODELED and explicitly labeled a screening superposition:
 * the warm plumes of the saved sites are added linearly at each sample point on
 * one shared grid (thermal-model.md "Cumulative mode"), which ignores tides,
 * currents, and plume–plume interaction. The panel renders only while
 * cumulative mode is on; with no saved sites it shows a hint to save some.
 */
import type { CumulativeResult } from '../model/cumulative';
import type { SpeciesEntry } from '../data/types';

export interface CumulativePanelProps {
  /** The superposed result over the saved sites (null before compute). */
  result: CumulativeResult | null;
  /** Species shown in the picker, for labeling per-species rows. */
  species: SpeciesEntry[];
  /** How many sites are saved, to drive the empty-state hint. */
  savedCount: number;
}

/** Format a km² figure with two decimals. */
function formatKm2(km2: number): string {
  return `${km2.toFixed(2)} km²`;
}

export function CumulativePanel({
  result,
  species,
  savedCount,
}: CumulativePanelProps) {
  const speciesName = (id: string): string =>
    species.find((s) => s.id === id)?.name ?? id;

  return (
    <section
      data-testid="cumulative-panel"
      aria-label="Cumulative results"
      style={{
        border: '1px solid #cfd8dc',
        borderRadius: 8,
        padding: '0.9rem 1rem',
        background: '#fff',
      }}
    >
      <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>
        Cumulative plume{' '}
        <span
          style={{ fontSize: '0.7rem', color: '#607d8b', letterSpacing: '0.03em' }}
        >
          · MODELED
        </span>
      </h2>

      {savedCount === 0 || !result ? (
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#607d8b' }}>
          Save sites to combine. Cumulative mode adds every saved site's screening
          plume at each sample point.
        </p>
      ) : (
        <>
          <p style={{ margin: '0 0 0.6rem', fontSize: '0.8rem', color: '#607d8b' }}>
            Superposition of {result.siteCount} saved site
            {result.siteCount === 1 ? '' : 's'}: excess temperatures added at each
            point on a shared grid.
          </p>

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
            <dt>Combined plume area</dt>
            <dd
              style={{
                margin: 0,
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatKm2(result.plumeAreaKm2)}
            </dd>
            <dt>Coverage</dt>
            <dd
              style={{
                margin: 0,
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {(result.coverage * 100).toFixed(0)}%
            </dd>
          </dl>

          {result.risks.length > 0 && (
            <div
              style={{
                padding: '0.6rem 0.7rem',
                background: '#f5f7f8',
                borderRadius: 6,
                fontSize: '0.82rem',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>
                Species areas (combined)
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.5 }}>
                {result.risks.map((risk) => (
                  <li key={risk.speciesId}>
                    {speciesName(risk.speciesId)}:{' '}
                    <strong>{formatKm2(risk.newlyExceededKm2)}</strong> newly
                    exceeded, {formatKm2(risk.alreadyExceededKm2)} already
                    exceeded.
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p style={{ margin: '0.5rem 0 0', fontSize: '0.72rem', color: '#78909c', lineHeight: 1.4 }}>
            Screening superposition only: plumes are added linearly and ignore
            tides, currents, and plume-to-plume interaction.
          </p>
        </>
      )}
    </section>
  );
}
