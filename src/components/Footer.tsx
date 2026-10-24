/**
 * Footer with data-source attribution (R1.3, R1.6). Every number on screen names
 * its source. The Footer lists each loaded snapshot's source, its MEASURED label
 * (R1.3), and when it was fetched (R1.6). It does not fetch — the caller passes
 * the loaded meta blocks, and a source whose meta is missing shows "unavailable".
 */
import type { SourceMetas } from '../data/useSnapshots';
import type { SnapshotMeta } from '../data/types';
import { FETCHED_AT_UNAVAILABLE, formatFetchedAt } from './formatFetchedAt';
import { layerLabel, type LayerId } from './layerLabels';

export interface FooterProps {
  /** Loaded snapshot meta blocks, keyed by source (fishbot, emolt, ndbc). */
  metas: SourceMetas;
}

interface SourceRow {
  id: LayerId;
  /** Short display name used when the snapshot meta is unavailable. */
  fallbackName: string;
  meta: SnapshotMeta | undefined;
}

export function Footer({ metas }: FooterProps) {
  const sources: SourceRow[] = [
    { id: 'fishbot', fallbackName: 'FIShBOT', meta: metas.fishbot },
    { id: 'emolt', fallbackName: 'eMOLT', meta: metas.emolt },
    { id: 'ndbc', fallbackName: 'NOAA NDBC buoy 44013', meta: metas.ndbc },
  ];

  return (
    <footer
      style={{
        padding: '0.75rem 1rem',
        background: '#eceff1',
        borderTop: '1px solid #d4dadd',
        fontSize: '0.8rem',
        color: '#4a5760',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: '0.4rem' }}>Data sources</div>
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
        }}
      >
        {sources.map((s) => (
          <SourceLine key={s.id} source={s} />
        ))}
      </ul>
      <p style={{ margin: '0.6rem 0 0' }}>
        Also: MassGIS land mask. Layers labeled MEASURED or MODELED. Missing values
        shown as gaps, never zero. Screening tool, not a permit decision.
      </p>
    </footer>
  );
}

/** One source: name, MEASURED/MODELED label, and when it was fetched (R1.3, R1.6). */
function SourceLine({ source }: { source: SourceRow }) {
  const { meta, fallbackName, id } = source;
  const name = meta?.source ?? fallbackName;
  const fetchedAt = meta ? formatFetchedAt(meta.fetchedAt) : FETCHED_AT_UNAVAILABLE;
  const available = meta != null;

  return (
    <li style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.4rem' }}>
      <span
        style={{
          fontSize: '0.65rem',
          fontWeight: 700,
          letterSpacing: '0.04em',
          padding: '0.05rem 0.35rem',
          borderRadius: 3,
          background: '#d4e4ec',
          color: '#1d4e63',
          flex: '0 0 auto',
        }}
      >
        {layerLabel(id)}
      </span>
      <span style={{ fontWeight: 600 }}>{name}</span>
      <span style={{ color: available ? '#607079' : '#9a3b30' }}>
        {available ? `fetched ${fetchedAt}` : 'snapshot unavailable'}
      </span>
    </li>
  );
}
