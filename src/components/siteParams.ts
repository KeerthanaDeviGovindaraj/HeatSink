/**
 * Pure, DOM-free metadata for the SiteEditor sliders and the facility params
 * they drive (R3.3). Kept in a plain `.ts` module (no JSX) so the node-env test
 * suite can import the slider specs and defaults without pulling in React.
 *
 * Numeric min/max are NOT duplicated here — they come from BOUNDS at render
 * time (constants.ts, the "only place numbers live"). Defaults mirror the R3.3
 * defaults; heatFraction uses DEFAULT_HEAT_FRACTION rather than an inline 0.88.
 */
import { DEFAULT_HEAT_FRACTION } from '../model/constants';

/** The four bounded facility parameters the user controls (R3.3). */
export interface SiteParams {
  facilityMW: number;
  deltaTC: number;
  mixRatio: number;
  heatFraction: number;
}

/** Default facility parameters (R3.3); heatFraction uses the named constant. */
export const DEFAULT_SITE_PARAMS: SiteParams = {
  facilityMW: 100,
  deltaTC: 4,
  mixRatio: 0,
  heatFraction: DEFAULT_HEAT_FRACTION,
};

/** Debounce window for slider-driven recompute (ms); design.md "Performance". */
export const RECOMPUTE_DEBOUNCE_MS = 100;

/**
 * Static metadata for each slider. `step`/`defaultValue`/`unit` live here; the
 * numeric min/max come from {@link BOUNDS} at render time so the two can never
 * drift (tests/components/flowCard.test.ts asserts this against BOUNDS).
 */
export interface SliderSpec {
  key: keyof SiteParams;
  label: string;
  step: number;
  defaultValue: number;
  /** Short unit suffix shown next to the current value ('' for dimensionless). */
  unit: string;
}

export const SLIDER_SPECS: readonly SliderSpec[] = [
  { key: 'facilityMW', label: 'Facility power', step: 1, defaultValue: DEFAULT_SITE_PARAMS.facilityMW, unit: ' MW' },
  { key: 'deltaTC', label: 'Discharge ΔT', step: 0.5, defaultValue: DEFAULT_SITE_PARAMS.deltaTC, unit: ' °C' },
  { key: 'mixRatio', label: 'Pre-mixing ratio', step: 0.1, defaultValue: DEFAULT_SITE_PARAMS.mixRatio, unit: '×' },
  { key: 'heatFraction', label: 'Heat fraction', step: 0.01, defaultValue: DEFAULT_SITE_PARAMS.heatFraction, unit: '' },
] as const;
