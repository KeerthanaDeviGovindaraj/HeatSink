/**
 * Pure ranking + summary helpers for the CompareTable (task 7.2, R6.2–R6.5).
 *
 * DOM-free and side-effect-free so they unit/property-test in a node env
 * (@testing-library/react is not installed). The component in CompareTable.tsx
 * only formats what these functions return.
 *
 * A "saved site" is a pure snapshot of a {@link SiteResult} the user chose to
 * compare, plus a human label (see {@link SavedSite}). runSite already produces
 * everything we rank on (per-species `score`/`level`, `coverage`,
 * `plumeAreaKm2`), so these helpers never recompute the model — they read the
 * committed snapshot.
 */
import { MIN_COVERAGE } from '../model/constants';
import type { SiteResult, SpeciesRisk } from '../model/types';

/** A snapshotted site the user saved to compare (max 4 in the UI, R6.4). */
export interface SavedSite {
  /** Stable id for list keys and removal. */
  id: string;
  /** Human label (preset name, or "Custom site N"). */
  label: string;
  /** Pure snapshot of the computed screening result. */
  result: SiteResult;
}

/**
 * True when the site has enough baseline data under the plume to trust its
 * scores (R6.2). Below MIN_COVERAGE the per-species cells show
 * "Insufficient data" and the site sorts last (lowest confidence).
 */
export function hasSufficientCoverage(result: SiteResult): boolean {
  return result.coverage >= MIN_COVERAGE;
}

/**
 * An overall risk number for a site, used to sort LOWEST RISK FIRST (R6.4).
 *
 * Rule: the MAXIMUM per-species `score` across the site's species risks. Each
 * species score is already bounded 0–100 (R6.1), so the max is too; a site is
 * "as risky as its worst-affected species". A site with no species risks (none
 * selected / none loaded) has no exceedance to rank, so its score is 0.
 *
 * Note on confidence: this score is only meaningful when coverage is
 * sufficient. Insufficient-data sites are not re-ranked by this number — they
 * are pushed to the end by {@link rankSites} regardless of their score, because
 * a low score computed over missing data is not trustworthy (R6.2).
 *
 * @param result A site's screening result.
 * @returns The site's overall risk in [0, 100].
 */
export function siteRiskScore(result: SiteResult): number {
  let max = 0;
  for (const risk of result.risks) {
    if (risk.score > max) max = risk.score;
  }
  return max;
}

/**
 * Sort saved sites LOWEST RISK FIRST (R6.4), returning a NEW array (does not
 * mutate the input).
 *
 * Ordering, in priority order:
 *   1. Sites with SUFFICIENT coverage come before insufficient-data sites.
 *      Insufficient-data sites are lowest-confidence, so they sort last rather
 *      than being interleaved by a score computed over missing data (R6.2).
 *   2. Within each group, ascending {@link siteRiskScore} (lowest risk first).
 *   3. Ties broken by ascending plume area (smaller footprint ranks first),
 *      then by label for a stable, deterministic order.
 *
 * @param sites The saved sites to rank (any length; the UI caps at 4).
 * @returns A new array sorted lowest-risk-first.
 */
export function rankSites(sites: SavedSite[]): SavedSite[] {
  return [...sites].sort((a, b) => {
    const aOk = hasSufficientCoverage(a.result);
    const bOk = hasSufficientCoverage(b.result);
    if (aOk !== bOk) return aOk ? -1 : 1; // sufficient-coverage sites first

    const scoreDiff = siteRiskScore(a.result) - siteRiskScore(b.result);
    if (scoreDiff !== 0) return scoreDiff;

    const areaDiff = a.result.plumeAreaKm2 - b.result.plumeAreaKm2;
    if (areaDiff !== 0) return areaDiff;

    return a.label.localeCompare(b.label);
  });
}

/** What a per-species score cell should display (R6.2, R6.5). */
export interface SpeciesCellLabel {
  /** The text to render in the cell. */
  text: string;
  /** True when coverage is below MIN_COVERAGE — render greyed out (R6.2). */
  insufficient: boolean;
  /** True for the "Low impact at screening level" case (R6.5). */
  lowImpact: boolean;
}

/**
 * Decide what one species' score cell shows for a site (R6.2, R6.5).
 *
 * Precedence:
 *   1. INSUFFICIENT (R6.2): when the site's coverage is below MIN_COVERAGE,
 *      show "Insufficient data" greyed out — regardless of the computed score.
 *      (speciesRisk already sets level = 'Insufficient data' in this case; we
 *      gate on the site's `coverage` so the whole row is consistent.)
 *   2. LOW IMPACT (R6.5): when coverage is sufficient AND newlyExceededKm2 is
 *      exactly 0, show "Low impact at screening level".
 *   3. Otherwise: the normal "<score> · <level>" (e.g. "42 · High").
 *
 * @param risk The per-species risk for this site.
 * @param opts.minCoverageMet Whether the site's coverage ≥ MIN_COVERAGE.
 * @returns The label text plus the `insufficient`/`lowImpact` flags.
 */
export function speciesCellLabel(
  risk: SpeciesRisk,
  opts: { minCoverageMet: boolean },
): SpeciesCellLabel {
  if (!opts.minCoverageMet) {
    return { text: 'Insufficient data', insufficient: true, lowImpact: false };
  }
  if (risk.newlyExceededKm2 === 0) {
    return {
      text: 'Low impact at screening level',
      insufficient: false,
      lowImpact: true,
    };
  }
  return {
    text: `${Math.round(risk.score)} · ${risk.level}`,
    insufficient: false,
    lowImpact: false,
  };
}
