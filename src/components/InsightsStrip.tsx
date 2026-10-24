/**
 * InsightsStrip — an at-a-glance, judge-facing summary of the current site
 * result (R6.1, R6.2, R4.4, R3.5). Presentational and derived entirely from the
 * already-computed {@link SiteResult}; it invents no numbers.
 *
 * The strip turns the model's outputs into a one-line verdict plus four
 * color-coded stat cards: the headline screening risk level (worst across the
 * site's species), the habitat area newly pushed past a species limit, the
 * plume reach, and the cooling-water flow at Brayton-Point scale — with data
 * coverage noted so low-confidence results read as such. Every figure keeps its
 * MODELED/MEASURED framing and the screening disclaimer stays in the banner.
 */
import type { SiteResult, SpeciesRisk, Level } from '../model/types';
import { MIN_COVERAGE } from '../model/constants';

export interface InsightsStripProps {
  /** The current screening result for the placed outfall. */
  result: SiteResult;
  /** Human label for the site (preset name or "Custom site"). */
  siteLabel: string;
}

/** Brayton Point historical peak once-through withdrawal (~1 billion gal/day). */
const BRAYTON_PEAK_MGD = 1000;

/** Palette per risk level (background, border, text) — colorblind-safe-ish. */
const LEVEL_STYLE: Record<Level, { bg: string; border: string; fg: string }> = {
  Low: { bg: '#e6f4ea', border: '#9fd4ae', fg: '#1b5e20' },
  Medium: { bg: '#fff4e5', border: '#f0c58a', fg: '#8a5300' },
  High: { bg: '#fdecea', border: '#e0a39d', fg: '#8a1c13' },
  'Insufficient data': { bg: '#eceff1', border: '#b0bec5', fg: '#455a64' },
};

/**
 * Pick the headline risk across the site's species: the worst level present.
 * "Insufficient data" is reported when coverage is below MIN_COVERAGE (the
 * per-species level already reflects this), so we rank it as its own state.
 */
function headlineRisk(risks: SpeciesRisk[]): SpeciesRisk | null {
  if (risks.length === 0) return null;
  const order: Record<Level, number> = {
    High: 3,
    Medium: 2,
    Low: 1,
    'Insufficient data': 0,
  };
  return risks.reduce((worst, r) => (order[r.level] > order[worst.level] ? r : worst));
}

/** Sum of newly-exceeded habitat area across all species (km²). */
function totalNewlyExceededKm2(risks: SpeciesRisk[]): number {
  return risks.reduce((sum, r) => sum + r.newlyExceededKm2, 0);
}

function fmtKm2(v: number): string {
  return `${v.toFixed(2)} km²`;
}

export function InsightsStrip({ result, siteLabel }: InsightsStripProps) {
  const { risks, plumeAreaKm2, coverage, thermal } = result;
  const headline = headlineRisk(risks);
  const level: Level = headline?.level ?? 'Low';
  const style = LEVEL_STYLE[level];
  const newlyKm2 = totalNewlyExceededKm2(risks);
  const lowConfidence = coverage < MIN_COVERAGE;
  const braytonPct = Math.round((thermal.flowMGD / BRAYTON_PEAK_MGD) * 100);

  // One-line plain-English verdict a judge can read in two seconds.
  const verdict = (() => {
    if (risks.length === 0) {
      return `Place or pick a species to see per-species risk at ${siteLabel}.`;
    }
    if (lowConfidence) {
      return `Not enough baseline data under the plume at ${siteLabel} to score confidently — treat as "insufficient data."`;
    }
    if (newlyKm2 === 0) {
      return `Low impact at screening level: the discharge pushes no new habitat past a species limit at ${siteLabel}.`;
    }
    return `At ${siteLabel}, the discharge pushes about ${fmtKm2(newlyKm2)} of habitat newly past a species limit — screening risk: ${level}.`;
  })();

  return (
    <section
      data-testid="insights-strip"
      aria-label="Key insights"
      style={{
        border: `1px solid ${style.border}`,
        borderLeft: `6px solid ${style.border}`,
        borderRadius: 10,
        padding: '0.9rem 1rem',
        background: style.bg,
        marginBottom: '1rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: '0.6rem',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.05rem', color: '#0b3d5c' }}>
          What this means{' '}
          <span style={{ fontSize: '0.68rem', color: '#607d8b', letterSpacing: '0.03em' }}>
            · SCREENING RESULT, NOT A PERMIT DECISION
          </span>
        </h2>
        <span
          style={{
            fontSize: '0.8rem',
            fontWeight: 700,
            color: style.fg,
            background: '#fff',
            border: `1px solid ${style.border}`,
            borderRadius: 999,
            padding: '0.15rem 0.6rem',
          }}
        >
          {level === 'Insufficient data' ? 'Insufficient data' : `${level} impact`}
        </span>
      </div>

      <p style={{ margin: '0 0 0.8rem', fontSize: '0.92rem', color: '#263238', lineHeight: 1.45 }}>
        {verdict}
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))',
          gap: '0.6rem',
        }}
      >
        <StatCard
          label="Newly exceeded habitat"
          value={fmtKm2(newlyKm2)}
          note="area pushed past a species limit by the discharge"
          tag="MODELED"
        />
        <StatCard
          label="Plume reach"
          value={`${(thermal.reachM / 1000).toFixed(1)} km`}
          note={`${fmtKm2(plumeAreaKm2)} warmed above ambient`}
          tag="MODELED"
        />
        <StatCard
          label="Cooling flow"
          value={`${thermal.flowMGD.toFixed(0)} MGD`}
          note={`≈ ${braytonPct}% of Brayton Point's peak`}
          tag="MODELED"
        />
        <StatCard
          label="Data coverage"
          value={`${Math.round(coverage * 100)}%`}
          note={
            lowConfidence
              ? `below ${Math.round(MIN_COVERAGE * 100)}% — low confidence`
              : 'of the plume has baseline data'
          }
          tag="MEASURED"
          warn={lowConfidence}
        />
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  note,
  tag,
  warn,
}: {
  label: string;
  value: string;
  note: string;
  tag: 'MODELED' | 'MEASURED';
  warn?: boolean;
}) {
  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${warn ? '#e0a39d' : '#dfe6ea'}`,
        borderRadius: 8,
        padding: '0.55rem 0.7rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: '0.4rem',
        }}
      >
        <span style={{ fontSize: '0.72rem', color: '#607d8b', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: '0.6rem', color: '#90a4ae', letterSpacing: '0.04em' }}>
          {tag}
        </span>
      </div>
      <div
        style={{
          fontSize: '1.35rem',
          fontWeight: 700,
          color: warn ? '#8a1c13' : '#0b3d5c',
          fontVariantNumeric: 'tabular-nums',
          margin: '0.1rem 0',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: '0.72rem', color: '#78909c', lineHeight: 1.35 }}>{note}</div>
    </div>
  );
}
