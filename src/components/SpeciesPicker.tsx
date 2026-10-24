/**
 * SpeciesPicker — pick one species to drive the map exceedance overlay
 * (task 7.1, R5.2–R5.4).
 *
 * Presentational and controlled: App passes the displayable species, the
 * current selection, and an onSelect callback. Each row shows the species name,
 * its threshold in °C, the cited source (R5.3), and an "unverified" badge when
 * `verified === false` (R5.3). A "None" option clears the overlay.
 *
 * DISPLAY rule (R5.2/R5.3): the caller filters with `isDisplayableSpecies`
 * (non-empty source + finite threshold) BEFORE passing `species` here, so a
 * sourceless entry is never shown (R5.2) and unverified entries ARE shown, with
 * the badge (R5.3). The picker does not re-filter.
 *
 * R5.4 is about a SELECTED species, so selection is single-choice (radios);
 * `selectedId === null` means no overlay.
 */
import { useState } from 'react';
import type { SpeciesEntry } from '../data/types';
import type { SpeciesRisk, Level } from '../model/types';

export interface SpeciesPickerProps {
  /** Displayable species (already filtered by isDisplayableSpecies). */
  species: SpeciesEntry[];
  /** The selected species id, or null for no overlay. */
  selectedId: string | null;
  /** Called with a species id to select it, or null to clear the overlay. */
  onSelect: (id: string | null) => void;
  /**
   * Per-species risk for the CURRENT site, keyed by species id, so each row
   * can show its newly-exceeded area and level. Omit/empty when no site is
   * placed yet (rows then show no figure).
   */
  risksById?: Map<string, SpeciesRisk>;
}

const RADIO_NAME = 'species-overlay';

/** Pull a short 'Author (Year)' citation out of a long source string. */
function shortSource(source: string): string {
  const m = source.match(/([A-Z][A-Za-z.'-]+(?:\s*(?:&|and|et al\.?)\s*[A-Z][A-Za-z.'-]+)*)\s*\((\d{4})\)/);
  return m ? `${m[1].trim()} (${m[2]})` : source.split('.')[0];
}

const LEVEL_CHIP: Record<Level, { bg: string; fg: string }> = {
  Low: { bg: '#e6f4ea', fg: '#1b5e20' },
  Medium: { bg: '#fff4e5', fg: '#8a5300' },
  High: { bg: '#fdecea', fg: '#8a1c13' },
  'Insufficient data': { bg: '#eceff1', fg: '#455a64' },
};

export function SpeciesPicker({ species, selectedId, onSelect, risksById }: SpeciesPickerProps) {
  const [detailsOpen, setDetailsOpen] = useState<Record<string, boolean>>({});
  return (
    <section
      data-testid="species-picker"
      aria-label="Species threshold overlay"
      style={{
        border: '1px solid #cfd8dc',
        borderRadius: 8,
        padding: '0.9rem 1rem',
        background: '#fff',
      }}
    >
      <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>
        Species threshold{' '}
        <span style={{ fontSize: '0.7rem', color: '#607d8b', letterSpacing: '0.03em' }}>
          · MODELED overlay
        </span>
      </h2>

      {species.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#78909c' }}>
          No species with a cited threshold are available.
        </p>
      ) : (
        <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
          <legend style={{ fontSize: '0.8rem', color: '#607d8b', marginBottom: '0.4rem' }}>
            Select a species to highlight exceeded points on the map.
          </legend>

          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.5rem' }}>
            {/* "None" clears the overlay. */}
            <li>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name={RADIO_NAME}
                  checked={selectedId === null}
                  onChange={() => onSelect(null)}
                />
                <span style={{ fontSize: '0.9rem' }}>None (hide overlay)</span>
              </label>
            </li>

            {species.map((s) => {
              const checked = s.id === selectedId;
              return (
                <li
                  key={s.id}
                  style={{
                    border: `1px solid ${checked ? '#0b3d5c' : '#e0e0e0'}`,
                    borderRadius: 6,
                    padding: '0.5rem 0.6rem',
                    background: checked ? '#eef5fa' : '#fafafa',
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name={RADIO_NAME}
                      checked={checked}
                      onChange={() => onSelect(s.id)}
                      style={{ marginTop: '0.2rem' }}
                    />
                    <span style={{ flex: 1 }}>
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          flexWrap: 'wrap',
                        }}
                      >
                        <strong style={{ fontSize: '0.9rem' }}>{s.name}</strong>
                        <span style={{ fontSize: '0.8rem', color: '#455a64' }}>
                          {s.thresholdC} °C
                        </span>
                        {!s.verified && <UnverifiedBadge />}
                        {(() => {
                          const risk = risksById?.get(s.id);
                          if (!risk) return null;
                          const chip = LEVEL_CHIP[risk.level];
                          return (
                            <span
                              style={{
                                marginLeft: 'auto',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                fontSize: '0.72rem',
                              }}
                            >
                              <span style={{ color: '#607d8b', fontVariantNumeric: 'tabular-nums' }}>
                                {risk.newlyExceededKm2.toFixed(2)} km² new
                              </span>
                              <span
                                style={{
                                  fontWeight: 700,
                                  color: chip.fg,
                                  background: chip.bg,
                                  borderRadius: 999,
                                  padding: '0.05rem 0.45rem',
                                }}
                              >
                                {risk.level}
                              </span>
                            </span>
                          );
                        })()}
                      </span>
                      <span
                        style={{
                          display: 'block',
                          marginTop: '0.3rem',
                          fontSize: '0.72rem',
                          color: '#78909c',
                          lineHeight: 1.4,
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>Source:</span> {shortSource(s.source)}{' '}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setDetailsOpen((o) => ({ ...o, [s.id]: !o[s.id] }));
                          }}
                          aria-expanded={!!detailsOpen[s.id]}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#0b6aa2',
                            cursor: 'pointer',
                            fontSize: '0.72rem',
                            textDecoration: 'underline',
                            padding: 0,
                          }}
                        >
                          {detailsOpen[s.id] ? 'hide' : 'details'}
                        </button>
                        {detailsOpen[s.id] && (
                          <span style={{ display: 'block', marginTop: '0.3rem' }}>{s.source}</span>
                        )}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}
    </section>
  );
}

/** Small "unverified" badge shown when a species threshold is not yet verified (R5.3). */
function UnverifiedBadge() {
  return (
    <span
      style={{
        fontSize: '0.65rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        color: '#8a5300',
        background: '#fff3e0',
        border: '1px solid #ffcc80',
        borderRadius: 4,
        padding: '0.05rem 0.35rem',
      }}
      title="This threshold has not been verified by a human against its cited source."
    >
      Unverified
    </span>
  );
}
