/**
 * Physical and calibration constants for the thermal screening model.
 * Defined once here; never inline these numbers elsewhere (tech.md).
 * SI units internally. See .kiro/steering/thermal-model.md.
 */

/** Watts per megawatt (W/MW). Used to convert facility power (MW) to SI watts. */
export const W_PER_MW = 1e6;

/** Seawater density (kg/m³). */
export const RHO_KG_M3 = 1025;

/** Seawater specific heat (J/(kg·K)). */
export const CP_J_KG_K = 3990;

/** Unit conversion: 1 m³/s expressed in million US gallons per day. */
export const MGD_PER_M3S = 22.824;

/** Excess temperature below this (°C) is ignored. */
export const NEGLIGIBLE_C = 0.1;

/** Fine sampling grid spacing (m). Each point represents 0.0625 km². */
export const SAMPLE_SPACING_M = 250;

/** Area represented by a single sample point (km²), = (SAMPLE_SPACING_M / 1000)². */
export const POINT_AREA_KM2 = 0.0625;

/** Sampling radius around the outfall (m). Max plume reach for valid inputs ≈ 17.9 km. */
export const R_REF_M = 20000;

/** ASSUMPTION: discharge treated as reaching the bottom only at or above this depth (m). */
export const SHALLOW_DEPTH_M = 20;

/** ASSUMPTION: score calibration constant (km²). */
export const AREA_SCALE_KM2 = 5;

/** Minimum share of plume points with baseline data for a valid score. */
export const MIN_COVERAGE = 0.5;

/** Default fraction of facility power dissipated to the cooling medium. */
export const DEFAULT_HEAT_FRACTION = 0.88;

/**
 * Reference scale for the "Brayton Point" comparison line (MGD).
 *
 * Brayton Point Station (Somerset, MA) was New England's largest fossil plant
 * and, at peak, the region's largest once-through seawater cooling withdrawal —
 * historically on the order of ~1 billion US gallons per day. Since
 * 1 billion gal/day = 1000 MGD, we use 1000 MGD as the upper anchor of the
 * flow-scale bar so users can see a facility's required cooling flow relative to
 * a real-world maximum (R3.5). This is an order-of-magnitude reference, not a
 * precise operating figure.
 *
 * Source: U.S. EPA, Brayton Point Station NPDES permit / fact sheet
 * (once-through cooling-water withdrawal ~1 billion gal/day). See
 * https://www.epa.gov/npdes-permits/brayton-point-station-npdes-permit
 */
export const BRAYTON_PEAK_MGD = 1000;

/** Plume decay-length calibration (ASSUMPTION, placeholder). */
export const LREF_M = 1500;
export const QREF_M3S = 4.4;

/** Validated input bounds. Out-of-range inputs throw a typed error. */
export const BOUNDS = {
  facilityMW: { min: 1, max: 500 },
  deltaTC: { min: 1, max: 10 },
  mixRatio: { min: 0, max: 5 },
  heatFraction: { min: 0.8, max: 0.95 },
} as const;
