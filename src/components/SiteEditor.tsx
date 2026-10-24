/**
 * SiteEditor — bounded facility controls + flow card (tasks 6.2, R3.3–R3.5).
 *
 * Four bounded range sliders drive the facility parameters (facilityMW, deltaTC,
 * mixRatio, heatFraction). Bounds and defaults come from BOUNDS and
 * DEFAULT_HEAT_FRACTION in constants.ts — never hard-coded here (R3.3).
 *
 * The flow card shows, from computeThermal: heat to water (MW), required flow in
 * m³/s and MGD, and a Brayton Point scale line comparing the site's flow to the
 * ~1-billion-gal/day reference (BRAYTON_PEAK_MGD), with a citation note (R3.5).
 *
 * Slider changes are debounced ~100 ms before recompute so dragging stays
 * responsive while the recompute target stays well under 500 ms (R3.4,
 * design.md "Performance").
 *
 * Controlled component: the parent (App) owns the params and the outfall; this
 * renders `params`/`value` and calls `onChange`. Flow depends only on facility
 * params, not location, so the card renders even before an outfall is placed.
 */
import { useEffect, useRef, useState } from 'react';
import { BOUNDS, BRAYTON_PEAK_MGD } from '../model/constants';
import { computeThermal } from '../model/thermal';
import { InputRangeError, type ThermalResult } from '../model/types';
import type { LatLon } from '../model/grid';
import { PRESET_SITES, type PresetSite } from '../model/presets';
import {
  braytonFraction,
  formatBraytonPercent,
  formatFlowM3s,
  formatFlowMGD,
  formatHeatMW,
} from './flowCard';
import {
  DEFAULT_SITE_PARAMS,
  RECOMPUTE_DEBOUNCE_MS,
  SLIDER_SPECS,
  type SiteParams,
  type SliderSpec,
} from './siteParams';

// Re-export the pure metadata so existing importers (App, tests) can keep
// importing SiteParams/DEFAULT_SITE_PARAMS from the component module.
export {
  DEFAULT_SITE_PARAMS,
  RECOMPUTE_DEBOUNCE_MS,
  SLIDER_SPECS,
  type SiteParams,
  type SliderSpec,
};

export interface SiteEditorProps {
  /** Current facility parameters (owned by the parent). */
  params: SiteParams;
  /** Called with the next params when the user moves a slider. */
  onChange: (next: SiteParams) => void;
  /** Where the outfall is, if placed — used only for the "not placed" note. */
  outfall: LatLon | null;
  /**
   * Optional: when provided, preset buttons set both the outfall location and
   * the facility params (R3.1 synergy). Omit to hide the preset row.
   */
  onSelectPreset?: (preset: PresetSite) => void;
}

/** A single labeled, accessible range slider bound to one param (R3.3). */
function Slider({
  spec,
  value,
  onChange,
}: {
  spec: SliderSpec;
  value: number;
  onChange: (next: number) => void;
}) {
  const bound = BOUNDS[spec.key];
  const id = `site-${spec.key}`;
  // heatFraction reads more naturally as a %, everything else as-is.
  const display =
    spec.key === 'heatFraction'
      ? `${Math.round(value * 100)}%`
      : `${value}${spec.unit}`;
  return (
    <div style={{ marginBottom: '0.6rem' }}>
      <label
        htmlFor={id}
        style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}
      >
        <span>{spec.label}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{display}</span>
      </label>
      <input
        id={id}
        type="range"
        min={bound.min}
        max={bound.max}
        step={spec.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={`${spec.label} (${bound.min} to ${bound.max})`}
        aria-valuemin={bound.min}
        aria-valuemax={bound.max}
        aria-valuenow={value}
        aria-valuetext={display}
        style={{ width: '100%' }}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.7rem',
          opacity: 0.6,
        }}
      >
        <span>{bound.min}</span>
        <span>{bound.max}</span>
      </div>
    </div>
  );
}

export function SiteEditor({ params, onChange, outfall, onSelectPreset }: SiteEditorProps) {
  // Debounced copy of params: recompute only after the user pauses ~100 ms.
  const [debounced, setDebounced] = useState<SiteParams>(params);
  const firstRun = useRef(true);

  useEffect(() => {
    // Apply the very first params immediately; debounce only subsequent moves.
    if (firstRun.current) {
      firstRun.current = false;
      setDebounced(params);
      return;
    }
    const timer = setTimeout(() => setDebounced(params), RECOMPUTE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [params]);

  // Compute the flow result from the debounced params. Sliders are bounded to
  // BOUNDS so valid values never throw, but guard defensively (R3.3).
  let result: ThermalResult | null = null;
  try {
    result = computeThermal({ lat: 0, lon: 0, ...debounced });
  } catch (err) {
    if (!(err instanceof InputRangeError)) throw err;
    result = null;
  }

  const setParam = (key: keyof SiteParams) => (next: number) =>
    onChange({ ...params, [key]: next });

  const fraction = result ? braytonFraction(result.flowMGD) : 0;

  // Which preset (if any) matches the current outfall, so the matching
  // button can show as selected and the editor states the chosen site.
  const activePreset = outfall
    ? PRESET_SITES.find(
        (p) => p.inputs.lat === outfall.lat && p.inputs.lon === outfall.lon,
      ) ?? null
    : null;

  return (
    <section
      data-testid="site-editor"
      aria-label="Site editor"
      style={{
        border: '1px solid #cfd8dc',
        borderRadius: 8,
        padding: '0.9rem 1rem',
        background: '#fff',
      }}
    >
      <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Hypothetical facility</h2>

      {onSelectPreset && (
        <div
          style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.8rem' }}
          aria-label="Preset sites"
        >
          {PRESET_SITES.map((preset) => {
            const selected = activePreset?.name === preset.name;
            return (
              <button
                key={preset.name}
                type="button"
                onClick={() => onSelectPreset(preset)}
                aria-pressed={selected}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.5rem',
                  border: `1px solid ${selected ? '#0b3d5c' : '#90a4ae'}`,
                  borderRadius: 999,
                  background: selected ? '#0b3d5c' : '#eceff1',
                  color: selected ? '#fff' : '#263238',
                  fontWeight: selected ? 700 : 400,
                  cursor: 'pointer',
                }}
              >
                {selected ? `\u2713 ${preset.name}` : preset.name}
              </button>
            );
          })}
        </div>
      )}

      {outfall ? (
        <p
          role="status"
          style={{
            margin: '0 0 0.7rem',
            padding: '0.4rem 0.6rem',
            fontSize: '0.8rem',
            background: '#e8f0f5',
            border: '1px solid #b5cfde',
            borderRadius: 6,
            color: '#0b3d5c',
          }}
        >
          <strong>Selected:</strong>{' '}
          {activePreset
            ? activePreset.name
            : `Custom location (${outfall.lat.toFixed(3)}, ${outfall.lon.toFixed(3)})`}
        </p>
      ) : (
        <p role="note" style={{ margin: '0 0 0.6rem', fontSize: '0.8rem', color: '#78909c' }}>
          No outfall placed yet — pick a preset above or click the map. The flow
          below depends only on facility settings.
        </p>
      )}

      {SLIDER_SPECS.map((spec) => (
        <Slider
          key={spec.key}
          spec={spec}
          value={params[spec.key]}
          onChange={setParam(spec.key)}
        />
      ))}

      {/* Flow card (R3.5). */}
      <div
        style={{
          marginTop: '0.8rem',
          padding: '0.7rem 0.8rem',
          background: '#f5f7f8',
          borderRadius: 6,
        }}
      >
        <div style={{ fontSize: '0.75rem', letterSpacing: '0.03em', color: '#607d8b' }}>
          REQUIRED COOLING FLOW <span style={{ opacity: 0.7 }}>· MODELED</span>
        </div>
        {result ? (
          <>
            <dl
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                rowGap: '0.2rem',
                columnGap: '0.6rem',
                margin: '0.4rem 0 0',
                fontSize: '0.9rem',
              }}
            >
              <dt>Heat to water</dt>
              <dd style={{ margin: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {formatHeatMW(result)}
              </dd>
              <dt>Flow (m³/s)</dt>
              <dd style={{ margin: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {formatFlowM3s(result)}
              </dd>
              <dt>Flow (MGD)</dt>
              <dd style={{ margin: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {formatFlowMGD(result)}
              </dd>
            </dl>

            {/* Brayton Point scale line (R3.5). */}
            <div style={{ marginTop: '0.6rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.75rem',
                  marginBottom: '0.2rem',
                }}
              >
                <span>vs. Brayton Point peak (~{BRAYTON_PEAK_MGD} MGD)</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatBraytonPercent(result.flowMGD)}
                </span>
              </div>
              <div
                role="meter"
                aria-label="Flow relative to Brayton Point peak"
                aria-valuemin={0}
                aria-valuemax={BRAYTON_PEAK_MGD}
                aria-valuenow={Math.min(result.flowMGD, BRAYTON_PEAK_MGD)}
                style={{
                  position: 'relative',
                  height: 10,
                  borderRadius: 5,
                  background: '#dfe6e9',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${fraction * 100}%`,
                    height: '100%',
                    background: '#0b6aa2',
                  }}
                />
              </div>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.68rem', color: '#78909c' }}>
                Reference: Brayton Point Station (Somerset, MA) historical peak
                once-through cooling-water withdrawal ≈ 1 billion gal/day (1000 MGD).
                Source: U.S. EPA NPDES permit / fact sheet.
              </p>
            </div>
          </>
        ) : (
          <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: '#b71c1c' }}>
            Inputs out of range — adjust the sliders.
          </p>
        )}
      </div>
    </section>
  );
}
