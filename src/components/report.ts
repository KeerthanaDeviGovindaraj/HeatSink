/**
 * Pure, DETERMINISTIC template summary generator for a site screening
 * (task 8.1, R7.1, R7.2).
 *
 * `buildSummaryMarkdown` turns a computed {@link SiteResult} plus the shown
 * species, the loaded source metas and an optional site label into a single
 * Markdown string. It is the SINGLE SOURCE OF TRUTH for the written summary:
 * the ReportPanel component only renders this string and wires copy / download.
 *
 * Determinism (R7.1): the same arguments always produce the identical string.
 * No `Date.now()`, no locale-dependent formatting. `formatFetchedAt` is the one
 * timestamp formatter used and it is fixed-shape UTC (see formatFetchedAt.ts).
 * Numbers are rounded with the shared `roundTo` helper so output is stable.
 *
 * DOM-free and side-effect-free so it unit/property-tests in a node env
 * (@testing-library/react is not installed).
 */
import {
  AREA_SCALE_KM2,
  MIN_COVERAGE,
  NEGLIGIBLE_C,
  R_REF_M,
  SHALLOW_DEPTH_M,
} from '../model/constants';
import type { SiteResult, SpeciesRisk } from '../model/types';
import type { SnapshotMeta, SpeciesEntry } from '../data/types';
import type { SourceMetas } from '../data/useSnapshots';
import { formatFetchedAt } from './formatFetchedAt';
import { heatMW, roundTo } from './flowCard';
import { hasSufficientCoverage, speciesCellLabel } from './compare';

/**
 * The screening-tool disclaimer, matching the AssumptionsBanner wording so the
 * printed summary carries the same honesty statement shown in the UI (R7.1).
 * Exported so the banner and any other surface can share one string.
 */
export const SCREENING_DISCLAIMER =
  'Screening heuristic, not a hydrodynamic model. Radially symmetric, no tides or ' +
  'currents, steady state, warm discharge assumed to reach the bottom only in water ' +
  `≤ ${SHALLOW_DEPTH_M} m deep, placeholder calibration constants. Not a permit decision.`;

/** Arguments for {@link buildSummaryMarkdown}. */
export interface SummaryArgs {
  /** The computed screening result for the placed outfall. */
  result: SiteResult;
  /** The species shown in the UI (displayable set), in display order. */
  species: SpeciesEntry[];
  /** Loaded source meta blocks (for the Sources section). */
  metas: SourceMetas;
  /** Human label for the site (preset name, or "Custom site"). */
  siteLabel?: string | undefined;
}

/** Round to 4 decimals for a tidy but faithful coordinate. */
function fmtCoord(n: number): number {
  return roundTo(n, 4);
}

/**
 * Build the per-species results section. Each shown species gets one line whose
 * classification matches the CompareTable EXACTLY (R6.2 / R6.5) by reusing
 * {@link speciesCellLabel}: "Insufficient data" when coverage is below
 * MIN_COVERAGE, "Low impact at screening level" when newlyExceededKm2 is 0 with
 * sufficient coverage, else "<score> · <level>". The threshold, source and an
 * "(unverified)" marker (R5.3) are appended so the summary is self-contained.
 */
function speciesLines(
  species: SpeciesEntry[],
  risks: SpeciesRisk[],
  minCoverageMet: boolean,
): string[] {
  const riskById = new Map(risks.map((r) => [r.speciesId, r]));
  return species.map((s) => {
    const risk = riskById.get(s.id);
    const classification = risk
      ? speciesCellLabel(risk, { minCoverageMet }).text
      : 'No result';
    const unverified = s.verified ? '' : ' (unverified)';
    const threshold =
      typeof s.thresholdC === 'number' && Number.isFinite(s.thresholdC)
        ? `${s.thresholdC} °C`
        : 'unknown';
    return `- **${s.name}${unverified}** — ${classification}; threshold ${threshold}; source: ${s.source}`;
  });
}

/** Build the Sources section from whatever metas are loaded. */
function sourceLines(metas: SourceMetas): string[] {
  const entries: Array<{ key: string; meta?: SnapshotMeta | undefined }> = [
    { key: 'FIShBOT', meta: metas.fishbot },
    { key: 'eMOLT', meta: metas.emolt },
    { key: 'NDBC', meta: metas.ndbc },
  ];
  const lines = entries
    .filter((e) => e.meta)
    .map(
      (e) =>
        `- **${e.key}** — ${e.meta!.source} (fetched ${formatFetchedAt(e.meta!.fetchedAt)})`,
    );
  return lines.length > 0 ? lines : ['- No sources loaded.'];
}

/**
 * Produce a deterministic Markdown summary for a site screening (R7.1).
 *
 * Sections, in order: title + coordinates, Inputs, Flow, Plume, Coverage,
 * Species results, Assumptions, Sources, and the screening Disclaimer.
 *
 * @param args See {@link SummaryArgs}.
 * @returns A Markdown string (same args → identical output).
 */
export function buildSummaryMarkdown(args: SummaryArgs): string {
  const { result, species, metas } = args;
  const label = args.siteLabel && args.siteLabel.trim().length > 0 ? args.siteLabel : 'Site';
  const { inputs, thermal, plumeAreaKm2, coverage, risks } = result;

  const minCoverageMet = hasSufficientCoverage(result);
  const coveragePct = roundTo(coverage * 100, 0);
  const minCoveragePct = roundTo(MIN_COVERAGE * 100, 0);
  const maxAreaKm2 = roundTo(Math.PI * (R_REF_M / 1000) ** 2, 0);

  const lines: string[] = [];

  // Title + location.
  lines.push(`# HeatSink screening summary — ${label}`);
  lines.push('');
  lines.push(
    `**Location:** ${fmtCoord(inputs.lat)}, ${fmtCoord(inputs.lon)} (outfall, in water)`,
  );
  lines.push('');

  // Inputs (R7.1).
  lines.push('## Inputs');
  lines.push(`- Facility power: ${roundTo(inputs.facilityMW, 0)} MW`);
  lines.push(`- Discharge ΔT: ${roundTo(inputs.deltaTC, 1)} °C`);
  lines.push(`- Pre-mixing ratio: ${roundTo(inputs.mixRatio, 2)}`);
  lines.push(`- Heat fraction to water: ${roundTo(inputs.heatFraction, 2)}`);
  lines.push('');

  // Flow (R7.1).
  lines.push('## Flow');
  lines.push(`- Heat to water: ${roundTo(heatMW(thermal), 0)} MW`);
  lines.push(`- Required cooling flow: ${roundTo(thermal.flowM3s, 2)} m³/s`);
  lines.push(`- Required cooling flow: ${roundTo(thermal.flowMGD, 1)} MGD`);
  lines.push('');

  // Plume (R7.1).
  lines.push('## Plume');
  lines.push(`- Plume area: ${roundTo(plumeAreaKm2, 2)} km²`);
  lines.push(`- Reach (to negligible, ${NEGLIGIBLE_C} °C): ${roundTo(thermal.reachM / 1000, 1)} km`);
  lines.push('');

  // Coverage (R7.1 / R6.2).
  lines.push('## Coverage');
  lines.push(
    `- Baseline coverage under the plume: ${coveragePct}% ` +
      `(${minCoverageMet ? 'meets' : 'below'} the ${minCoveragePct}% minimum for a trusted score)`,
  );
  lines.push('');

  // Species results (R7.1, R6.2/R6.5, R5.3).
  lines.push('## Species results');
  if (species.length > 0) {
    lines.push(...speciesLines(species, risks, minCoverageMet));
  } else {
    lines.push('- No species selected.');
  }
  lines.push('');

  // Assumptions — the MODELED placeholder constants (R7.1, R6.3).
  lines.push('## Assumptions');
  lines.push('Screening placeholder constants (not calibrated to this site):');
  lines.push(`- Score area scale (AREA_SCALE_KM2): ${AREA_SCALE_KM2} km²`);
  lines.push(`- Minimum coverage (MIN_COVERAGE): ${MIN_COVERAGE}`);
  lines.push(`- Negligible excess (NEGLIGIBLE_C): ${NEGLIGIBLE_C} °C`);
  lines.push(`- Shallow-water depth (SHALLOW_DEPTH_M): ${SHALLOW_DEPTH_M} m`);
  lines.push(`- Sampling radius (R_REF_M): ${R_REF_M / 1000} km (max plume area ${maxAreaKm2} km²)`);
  lines.push('');

  // Sources (R7.1).
  lines.push('## Sources');
  lines.push(...sourceLines(metas));
  lines.push('');

  // Disclaimer (R7.1).
  lines.push('## Disclaimer');
  lines.push(SCREENING_DISCLAIMER);

  return lines.join('\n');
}

/**
 * A filesystem-safe filename for the downloaded summary, derived from the
 * outfall coordinates so it is deterministic and unique per site, e.g.
 * `heatsink-summary-41_84--70_49.md`.
 */
export function summaryFileName(result: SiteResult): string {
  const safe = (n: number): string => String(fmtCoord(n)).replace(/[.]/g, '_');
  return `heatsink-summary-${safe(result.inputs.lat)}-${safe(result.inputs.lon)}.md`;
}
