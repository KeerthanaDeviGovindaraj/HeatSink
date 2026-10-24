/**
 * Reusable error card (R1.7). When a snapshot fails to load, HeatSink shows this
 * card — a friendly message plus the underlying error detail — instead of a
 * blank map. Marked role="alert" so assistive tech announces it. Pure
 * presentation; the caller decides when to render it.
 */

export interface ErrorCardProps {
  /** Short, friendly headline (e.g. "Could not load the baseline data"). */
  title?: string;
  /** Underlying technical detail (an error message); shown as secondary text. */
  detail?: string;
}

const DEFAULT_TITLE = 'Something went wrong loading the data';

export function ErrorCard({ title = DEFAULT_TITLE, detail }: ErrorCardProps) {
  return (
    <div
      role="alert"
      data-testid="error-card"
      style={{
        margin: '1rem 0',
        padding: '1rem 1.1rem',
        background: '#fdecea',
        border: '1px solid #c0392b',
        borderRadius: 6,
        color: '#7a1c12',
        fontSize: '0.9rem',
        lineHeight: 1.5,
      }}
    >
      <strong style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.95rem' }}>
        {title}
      </strong>
      <p style={{ margin: 0 }}>
        The map can't be shown right now. This is usually a temporary snapshot or
        network problem — try reloading the page.
      </p>
      {detail != null && detail !== '' && (
        <p
          style={{
            margin: '0.5rem 0 0',
            fontSize: '0.8rem',
            color: '#9a3b30',
            wordBreak: 'break-word',
          }}
        >
          Detail: {detail}
        </p>
      )}
    </div>
  );
}
